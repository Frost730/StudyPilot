/**
 * Enhanced Text-to-Speech utility for StudyPilot.
 *
 * Fixes common SpeechSynthesis pitfalls:
 * - Chunks long text to avoid the browser's ~300-char silent cutoff
 * - Loads voices asynchronously (Chrome fires voiceschanged)
 * - Adds pause / resume / stop / speed / pitch / voice selection
 * - Strips markdown before speaking
 */

// ────────────────── Voice Loading ──────────────────

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }
    // Chrome loads voices async
    const handleVoicesChanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    
    // Fallback timeout
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 500);
  });
}

// Preload on import
loadVoices();

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices;
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return getAvailableVoices().filter((v) => v.lang.startsWith('en'));
}

export function getBestDefaultVoice(): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  // Prefer Google voices (higher quality), then Microsoft, then any English
  return (
    voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google')) ||
    voices.find((v) => v.lang.startsWith('en') && v.name.includes('Microsoft') && v.name.includes('Online')) ||
    voices.find((v) => v.lang.startsWith('en') && !v.localService) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0] ||
    null
  );
}

// ────────────────── Text Cleaning ──────────────────

export function cleanMarkdownForSpeech(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove inline code
    .replace(/`[^`]*`/g, '')
    // Remove markdown headers markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Collapse multiple whitespace / newlines
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ────────────────── Chunking ──────────────────
// SpeechSynthesis on Chrome silently stops at ~200-300 characters.
// We chunk at sentence boundaries to stay well under this limit.

const MAX_CHUNK_LENGTH = 180;

export function chunkTextForSpeech(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;:])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    // If a single sentence exceeds limit, split by commas/words
    if (sentence.length > MAX_CHUNK_LENGTH) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      const subParts = sentence.split(/(?<=,)\s+/);
      for (const sub of subParts) {
        if (sub.length > MAX_CHUNK_LENGTH) {
          // Last resort: split by word boundary at MAX_CHUNK_LENGTH
          let remaining = sub;
          while (remaining.length > MAX_CHUNK_LENGTH) {
            let cutIdx = remaining.lastIndexOf(' ', MAX_CHUNK_LENGTH);
            if (cutIdx <= 0) cutIdx = MAX_CHUNK_LENGTH;
            chunks.push(remaining.slice(0, cutIdx).trim());
            remaining = remaining.slice(cutIdx).trim();
          }
          if (remaining) chunks.push(remaining);
        } else if ((current + ' ' + sub).length > MAX_CHUNK_LENGTH) {
          if (current.trim()) chunks.push(current.trim());
          current = sub;
        } else {
          current = current ? current + ' ' + sub : sub;
        }
      }
      continue;
    }

    if ((current + ' ' + sentence).length > MAX_CHUNK_LENGTH) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ────────────────── Speech Controller ──────────────────

export interface SpeechOptions {
  rate?: number;      // 0.5 – 2.0, default 1.0
  pitch?: number;     // 0 – 2.0, default 1.0
  voice?: SpeechSynthesisVoice | null;
  voiceURI?: string;  // Added for dynamic lookup
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onChunkProgress?: (current: number, total: number) => void;
}

let currentChunkIdx = 0;
let totalChunks = 0;
let chunksQueue: string[] = [];
let currentOptions: SpeechOptions = {};
let isSpeakingActive = false;
let isResettingUtterance = false;
let watchdogTimeoutId: any = null;

function clearWatchdog() {
  if (watchdogTimeoutId !== null) {
    clearTimeout(watchdogTimeoutId);
    watchdogTimeoutId = null;
  }
}

function startWatchdog(text: string) {
  clearWatchdog();
  // Safe limit: length of text * 120ms + 5000ms safety window
  const durationMs = Math.max(6000, text.length * 120 + 5000);
  
  watchdogTimeoutId = setTimeout(() => {
    console.warn("Speech Synthesis Watchdog fired: speech synthesis appears stuck. Advancing chunk.");
    if (isSpeakingActive) {
      currentChunkIdx++;
      currentOptions.onChunkProgress?.(currentChunkIdx, totalChunks);
      speakNextChunk();
    }
  }, durationMs);
}

export function speakText(rawText: string, options: SpeechOptions = {}) {
  stopSpeaking();

  const cleaned = cleanMarkdownForSpeech(rawText);
  if (!cleaned) return;

  chunksQueue = chunkTextForSpeech(cleaned);
  totalChunks = chunksQueue.length;
  currentChunkIdx = 0;
  currentOptions = options;
  isSpeakingActive = true;

  options.onStart?.();
  speakNextChunk();
}

function speakNextChunk() {
  clearWatchdog();
  
  if (!isSpeakingActive || currentChunkIdx >= chunksQueue.length) {
    isSpeakingActive = false;
    currentOptions.onEnd?.();
    return;
  }

  const text = chunksQueue[currentChunkIdx];
  const utterance = new SpeechSynthesisUtterance(text);

  // Apply options
  utterance.rate = currentOptions.rate ?? 1.0;
  utterance.pitch = currentOptions.pitch ?? 1.0;

  let voice = currentOptions.voice ?? getBestDefaultVoice();
  if (currentOptions.voiceURI) {
    const foundVoice = getAvailableVoices().find(v => v.voiceURI === currentOptions.voiceURI);
    if (foundVoice) voice = foundVoice;
  }
  if (voice) utterance.voice = voice;

  utterance.onend = () => {
    clearWatchdog();
    if (isResettingUtterance) return;
    currentChunkIdx++;
    currentOptions.onChunkProgress?.(currentChunkIdx, totalChunks);
    setTimeout(() => speakNextChunk(), 50);
  };

  utterance.onerror = (e) => {
    clearWatchdog();
    if (isResettingUtterance) return;
    if (e.error === 'interrupted' || e.error === 'canceled') {
      return;
    }
    console.warn('Speech chunk error:', e.error, `chunk ${currentChunkIdx}/${totalChunks}`);
    currentChunkIdx++;
    setTimeout(() => speakNextChunk(), 100);
  };

  currentOptions.onChunkProgress?.(currentChunkIdx, totalChunks);
  
  startWatchdog(text);
  window.speechSynthesis.speak(utterance);
}

export function updateSpeechOptions(newOptions: Partial<SpeechOptions>) {
  currentOptions = { ...currentOptions, ...newOptions };
  
  if (isSpeakingActive && chunksQueue.length > 0 && currentChunkIdx < chunksQueue.length) {
    isResettingUtterance = true;
    window.speechSynthesis.cancel();
    
    // Resume current chunk index with new options
    setTimeout(() => {
      isResettingUtterance = false;
      if (isSpeakingActive) {
        speakNextChunk();
      }
    }, 80);
  }
}

export function pauseSpeaking() {
  clearWatchdog();
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    currentOptions.onPause?.();
  }
}

export function resumeSpeaking() {
  if (window.speechSynthesis.paused) {
    if (chunksQueue[currentChunkIdx]) {
      startWatchdog(chunksQueue[currentChunkIdx]);
    }
    window.speechSynthesis.resume();
    currentOptions.onResume?.();
  }
}

export function stopSpeaking() {
  clearWatchdog();
  isSpeakingActive = false;
  window.speechSynthesis.cancel();
  chunksQueue = [];
  currentChunkIdx = 0;
  totalChunks = 0;
}

export function isSpeechActive(): boolean {
  return isSpeakingActive;
}

export function getSpeechProgress(): { current: number; total: number } {
  return { current: currentChunkIdx, total: totalChunks };
}
