import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { renderAvatar } from '../utils/avatar';

import { 
  Send, Plus, MessageSquare, Trash2, FileText, 
  BookOpen, ExternalLink, Loader2, Sparkles,
  Volume2, VolumeX, Pause, Play
} from 'lucide-react';
import { 
  speakText, stopSpeaking, pauseSpeaking, resumeSpeaking, 
  updateSpeechOptions, getAvailableVoices, getBestDefaultVoice 
} from '../utils/speechService';

interface Citation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  content: string;
}

interface Message {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt?: string;
}

interface ChatSession {
  _id: string;
  title: string;
  createdAt: string;
}

interface DocumentOption {
  _id: string;
  name: string;
}

// Simple custom Markdown to HTML converter to avoid importing heavy markdown libs
const renderMarkdown = (text: string) => {
  if (!text) return '';
  
  let formatted = text
    // Replace headers
    .replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold mt-3 mb-1 text-foreground dark:text-zinc-100">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 class="text-base font-bold mt-4 mb-1.5 text-foreground dark:text-zinc-100">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 class="text-lg font-bold mt-5 mb-2 text-foreground dark:text-zinc-50">$1</h2>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-violet-600 dark:text-violet-400">$1</strong>')
    // Code block formatting
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-zinc-950 p-3 rounded-lg overflow-x-auto text-xs border border-zinc-800 text-zinc-300 font-mono my-2.5">$1</pre>')
    // Inline code
    .replace(/`(.*?)`/g, '<code class="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-fuchsia-600 dark:text-fuchsia-400 text-xs font-mono">$1</code>')
    // Unordered lists
    .replace(/^\s*[-*]\s+(.*)$/gim, '<li class="list-disc ml-5 text-sm my-1 text-muted-foreground dark:text-zinc-300">$1</li>')
    // Newlines
    .replace(/\n/g, '<br/>');

  return <div dangerouslySetInnerHTML={{ __html: formatted }} className="space-y-1 text-sm leading-relaxed text-card-foreground dark:text-zinc-300" />;
};

export const ChatPage: React.FC = () => {
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  
  // Input parameters
  const [inputText, setInputText] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  
  // UI states
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [speechPaused, setSpeechPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechProgress, setSpeechProgress] = useState({ current: 0, total: 0 });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  
  // Citation Modal state
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load and listen to speech voices
  useEffect(() => {
    const updateVoiceList = () => {
      const allVoices = getAvailableVoices();
      const engVoices = allVoices.filter(v => v.lang.startsWith('en'));
      setVoices(engVoices.length > 0 ? engVoices : allVoices);
      
      const defaultVoice = getBestDefaultVoice();
      if (defaultVoice) {
        setSelectedVoiceURI(prev => prev || defaultVoice.voiceURI);
      }
    };

    updateVoiceList();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoiceList);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoiceList);
    };
  }, []);

  // Scroll messages view to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    stopSpeaking();
    setSpeakingMsgIdx(null);
    setSpeechPaused(false);
  }, [messages]);

  const handleToggleSpeech = (text: string, index: number) => {
    if (speakingMsgIdx === index) {
      stopSpeaking();
      setSpeakingMsgIdx(null);
      setSpeechPaused(false);
      setSpeechProgress({ current: 0, total: 0 });
    } else {
      stopSpeaking();
      setSpeakingMsgIdx(index);
      setSpeechPaused(false);

      speakText(text, {
        rate: speechRate,
        voiceURI: selectedVoiceURI,
        onEnd: () => {
          setSpeakingMsgIdx(null);
          setSpeechPaused(false);
          setSpeechProgress({ current: 0, total: 0 });
        },
        onChunkProgress: (current, total) => {
          setSpeechProgress({ current, total });
        },
      });
    }
  };

  const handlePauseResume = () => {
    if (speechPaused) {
      resumeSpeaking();
      setSpeechPaused(false);
    } else {
      pauseSpeaking();
      setSpeechPaused(true);
    }
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIdx = speeds.indexOf(speechRate);
    const nextIdx = (currentIdx + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setSpeechRate(newSpeed);
    updateSpeechOptions({ rate: newSpeed });
  };

  const handleVoiceChange = (voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    updateSpeechOptions({ voiceURI });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat session history and document choices on mount
  useEffect(() => {
    fetchHistory();
    fetchDocumentOptions();
  }, []);

  // Listen for global search triggers from Navbar
  useEffect(() => {
    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      const query = customEvent.detail?.query;
      if (query) {
        setInputText(query);
        sendMessage(query);
      }
    };
    window.addEventListener('globalSearchTriggered', handleGlobalSearch);
    return () => window.removeEventListener('globalSearchTriggered', handleGlobalSearch);
  }, [activeSessionId, selectedDocId, token]);

  // Fetch documents for selector
  const fetchDocumentOptions = async () => {
    try {
      const response = await api.get('/documents');
      const readyDocs = response.data.documents.filter((d: any) => d.status === 'ready');
      setDocuments(readyDocs);
    } catch (error) {
      console.error('Error fetching document list:', error);
    }
  };

  // Fetch session list
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await api.get('/chat/history');
      setSessions(response.data.chats);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load selected session messages
  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const response = await api.get(`/chat/session/${id}`);
      setMessages(response.data.chat.messages);
    } catch (error) {
      console.error('Error loading chat session:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Start new empty conversation
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  // Delete chat session
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation log?')) return;
    try {
      await api.delete(`/chat/session/${id}`);
      if (activeSessionId === id) {
        handleNewChat();
      }
      fetchHistory();
    } catch (error) {
      console.error('Error deleting chat session:', error);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || generating) return;

    const userPrompt = messageText.trim();
    setGenerating(true);

    // Append user message immediately
    const userMessage: Message = { role: 'user', content: userPrompt };
    setMessages((prev) => [...prev, userMessage]);

    // Add empty placeholder message for streaming assistant response
    const assistantMessagePlaceholder: Message = { role: 'assistant', content: '', citations: [] };
    setMessages((prev) => [...prev, assistantMessagePlaceholder]);

    let fullOutput = '';
    let citationsArray: Citation[] = [];

    try {
      // Connect using direct fetch for POST streaming
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: userPrompt,
          chatId: activeSessionId,
          documentId: selectedDocId || undefined,
        }),
      });

      if (!response.body) {
        throw new Error('Connection response contains no readable data body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });
        
        // Parse SSE chunks (delimited by "data: ")
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawJson = line.substring(6).trim();
            if (!rawJson) continue;

            try {
              const data = JSON.parse(rawJson);
              
              if (data.text) {
                fullOutput += data.text;
                // Update assistant message content in state in real-time
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: fullOutput,
                  };
                  return updated;
                });
              }

              if (data.done) {
                citationsArray = data.citations || [];
                // Update conversation ID if newly created
                if (!activeSessionId && data.chatId) {
                  setActiveSessionId(data.chatId);
                  fetchHistory();
                }

                // Finalize assistant message parameters
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    citations: citationsArray,
                  };
                  return updated;
                });
              }
            } catch (err) {
              // Ignore partial parsing errors
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error during chat stream execution:', error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          role: 'assistant',
          content: `Sorry, we experienced an issue processing your query: ${error.message || 'API error'}`,
        };
        return updated;
      });
    } finally {
      setGenerating(false);
    }
  };

  // Send message with POST streaming
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || generating) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-2xl overflow-hidden border border-border bg-card shadow-sm transition-colors duration-300">
      
      {/* 1. Chat History Sidebar Panel */}
      <div className="hidden lg:flex flex-col w-72 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-secondary border border-border hover:bg-secondary/75 text-sm font-semibold rounded-xl transition-all"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {historyLoading ? (
            <div className="p-4 flex items-center gap-2 justify-center text-muted-foreground text-xs">
              <Loader2 className="animate-spin h-4 w-4 text-primary" /> Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-xs mt-4">
              No previous chats found.
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session._id}
                onClick={() => handleSelectSession(session._id)}
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-xs font-medium group transition-all ${
                  activeSessionId === session._id 
                    ? 'bg-secondary text-foreground font-semibold border-l-2 border-primary pl-2' 
                    : 'text-muted-foreground hover:bg-secondary/35 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, session._id)}
                  className="p-1 hover:bg-zinc-800 rounded text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Chat Terminal Panel */}
      <div className="flex-1 flex flex-col bg-background/25">
        
        {/* Terminal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
            <span>RAG Document Query</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground hidden sm:inline-block">Scope:</label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-secondary border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer max-w-[200px]"
            >
              <option value="">All Uploaded Documents</option>
              {documents.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages Thread container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messagesLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
              <p className="text-sm">Fetching discussion log...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground max-w-lg mx-auto mt-12">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-violet-500/15">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground text-base mb-1">RAG Chat Assistant</h3>
              <p className="text-xs leading-relaxed mb-4">
                Ask specific questions about your uploaded PDFs. The AI scans and finds matching page passages, formulates cited answers, and provides page reference listings.
              </p>
              {documents.length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs">
                  Please upload some PDFs in the <strong>My Documents</strong> tab first to test the RAG engine!
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`flex gap-2 items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 mb-1">
                      {renderAvatar("bot", "AI Assistant", "h-7 w-7 text-[10px]")}
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 border shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary border-primary/20 text-primary-foreground rounded-tr-none' 
                      : 'bg-card border-border text-card-foreground dark:text-zinc-100 rounded-tl-none'
                  }`}>
                    {/* Render message body */}
                    {msg.role === 'user' ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-2 relative group/msg">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">{renderMarkdown(msg.content)}</div>
                          <button
                            type="button"
                            onClick={() => handleToggleSpeech(msg.content, index)}
                            className={`p-1.5 rounded-lg hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all shrink-0 mt-0.5 border border-border/40 ${
                              speakingMsgIdx === index ? 'bg-violet-500/15 opacity-100' : 'bg-secondary/80 opacity-0 group-hover/msg:opacity-100'
                            }`}
                            title={speakingMsgIdx === index ? "Stop reading" : "Read aloud"}
                          >
                            {speakingMsgIdx === index ? (
                              <VolumeX className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                           {speakingMsgIdx === index && (
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              <button
                                type="button"
                                onClick={handlePauseResume}
                                className="p-1.5 rounded-lg bg-secondary/80 hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all border border-border/40"
                                title={speechPaused ? 'Resume' : 'Pause'}
                              >
                                {speechPaused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-amber-400" />}
                              </button>
                              <button
                                type="button"
                                onClick={cycleSpeed}
                                className="px-1.5 py-1 rounded-lg bg-secondary/80 hover:bg-zinc-800 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all border border-border/40 min-w-[36px]"
                                title="Change speed"
                              >
                                {speechRate}x
                              </button>
                              {speechProgress.total > 0 && (
                                <span className="px-1.5 py-1 rounded-lg bg-secondary/80 border border-border/40 text-[9px] font-bold text-muted-foreground shrink-0 select-none">
                                  {speechProgress.current}/{speechProgress.total}
                                </span>
                              )}
                              {voices.length > 0 && (
                                <select
                                  value={selectedVoiceURI}
                                  onChange={(e) => handleVoiceChange(e.target.value)}
                                  className="bg-secondary/80 hover:bg-zinc-800 text-[10px] font-semibold text-muted-foreground hover:text-foreground py-1 px-1.5 rounded-lg border border-border/40 cursor-pointer max-w-[95px] truncate focus:outline-none"
                                  title="Select voice"
                                >
                                  {voices.map((v) => (
                                    <option key={v.voiceURI} value={v.voiceURI} className="bg-zinc-900 text-foreground">
                                      {v.name.replace('Microsoft', 'MS').replace('Google', 'Google')}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Render Citations if assistants finished response */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-2 border-t border-border mt-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Source Citations:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.citations.map((cit, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedCitation(cit)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-secondary hover:bg-zinc-800 text-[10px] font-semibold text-violet-400 rounded-md border border-border transition-all hover:scale-[1.02]"
                                >
                                  <FileText className="h-3 w-3 shrink-0" />
                                  <span className="max-w-[120px] truncate">{cit.documentName}</span>
                                  <span>p.{cit.pageNumber}</span>
                                  <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="shrink-0 mb-1">
                      {renderAvatar(user?.avatar, user?.name, "h-7 w-7 text-[10px]")}
                    </div>
                  )}
                </div>
              ))}
              {generating && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="animate-spin h-3.5 w-3.5 text-primary" /> Core index scanning in progress...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form Footer */}
        <form onSubmit={handleSend} className="p-4 border-t border-border bg-card flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={generating}
            placeholder={
              documents.length === 0 
                ? "Upload PDFs first to initiate chats..." 
                : "Ask anything about your study materials..."
            }
            className="flex-1 px-4 py-3 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || generating || documents.length === 0}
            className="p-3 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.04]"
          >
            {generating ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>

      {/* 3. Citation Details modal overlay */}
      {selectedCitation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 relative">
            <h3 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2 mb-4">
              <BookOpen className="h-5 w-5 text-violet-500" />
              <span>Citation Reference</span>
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-secondary p-3 rounded-xl border border-border">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Source Document:</span>
                  <span className="font-semibold text-foreground truncate block">{selectedCitation.documentName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Page Number:</span>
                  <span className="font-semibold text-foreground">Page {selectedCitation.pageNumber}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-1">Indexed Content Fragment:</span>
                <p className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-sm font-normal text-zinc-300 leading-relaxed max-h-[220px] overflow-y-auto whitespace-pre-wrap font-sans">
                  {selectedCitation.content}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 bg-secondary text-foreground border border-border hover:bg-zinc-800 rounded-xl text-sm font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
