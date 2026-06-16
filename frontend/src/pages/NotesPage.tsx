import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { FileText, Sparkles, Loader2, Edit, Save, Trash2, ArrowLeft, Eye, BookOpen, AlertCircle, Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { 
  speakText, stopSpeaking, pauseSpeaking, resumeSpeaking, 
  updateSpeechOptions, getAvailableVoices, getBestDefaultVoice 
} from '../utils/speechService';

interface Notes {
  _id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface DocumentOption {
  _id: string;
  name: string;
}

// Simple markdown parser helper for study notes
const renderNotesMarkdown = (text: string) => {
  if (!text) return '';
  
  let formatted = text
    .replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold mt-4 mb-1.5 text-foreground dark:text-zinc-100">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 class="text-base font-bold mt-5 mb-2 text-foreground dark:text-zinc-100 border-b border-border pb-1">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 class="text-lg font-bold mt-6 mb-3 text-foreground dark:text-zinc-50">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-violet-600 dark:text-violet-400">$1</strong>')
    .replace(/^\s*[-*]\s+(.*)$/gim, '<li class="list-disc ml-5 text-sm my-1 text-muted-foreground dark:text-zinc-300">$1</li>')
    .replace(/\n/g, '<br/>');

  return <div dangerouslySetInnerHTML={{ __html: formatted }} className="space-y-1 text-sm leading-relaxed text-card-foreground dark:text-zinc-300" />;
};

export const NotesPage: React.FC = () => {
  const [notesList, setNotesList] = useState<Notes[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  
  // Selection/Generation state
  const [selectedDocId, setSelectedDocId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Active notes view state
  const [activeNote, setActiveNote] = useState<Notes | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [updating, setUpdating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechPaused, setSpeechPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');

  useEffect(() => {
    fetchDocuments();
    fetchNotes();
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setSpeechPaused(false);
  }, [activeNote]);

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

  const handleToggleSpeech = () => {
    if (!activeNote) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      setSpeechPaused(false);
    } else {
      stopSpeaking();
      setIsSpeaking(true);
      setSpeechPaused(false);

      speakText(activeNote.content, {
        rate: speechRate,
        voiceURI: selectedVoiceURI,
        onEnd: () => {
          setIsSpeaking(false);
          setSpeechPaused(false);
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

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/documents');
      setDocuments(response.data.documents.filter((d: any) => d.status === 'ready'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/notes');
      setNotesList(response.data.notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setError('Please select a document to generate study notes.');
      return;
    }

    setError('');
    setGenerating(true);
    try {
      const response = await api.post('/notes/generate', {
        documentId: selectedDocId,
      });
      const newNote = response.data.notes;
      setNotesList((prev) => [newNote, ...prev]);
      handleViewNote(newNote);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error generating notes');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewNote = (note: Notes) => {
    setActiveNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditMode(false);
  };

  const handleSaveEdits = async () => {
    if (!activeNote || !editTitle.trim() || !editContent.trim()) return;
    setUpdating(true);
    try {
      const response = await api.put(`/notes/${activeNote._id}`, {
        title: editTitle.trim(),
        content: editContent,
      });
      
      const updatedNote = response.data.note;
      setActiveNote(updatedNote);
      setNotesList((prev) =>
        prev.map((n) => (n._id === updatedNote._id ? updatedNote : n))
      );
      setEditMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error updating note');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteNote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Delete this study notes file?')) return;
    
    try {
      await api.delete(`/notes/${id}`);
      setNotesList((prev) => prev.filter((n) => n._id !== id));
      if (activeNote?._id === id) {
        setActiveNote(null);
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Study Notes</h1>
        <p className="text-sm text-muted-foreground">Synthesize textbooks and slides into summaries, terminology logs, and exam revision hints.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* 1. ACTIVE NOTE EXPANDED VIEW */}
      {activeNote ? (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <button
              onClick={() => setActiveNote(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Notebooks
            </button>

            <div className="flex gap-2">
              {editMode ? (
                <>
                  <button
                    onClick={handleSaveEdits}
                    disabled={updating}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    {updating ? (
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save Edits
                  </button>
                  
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditTitle(activeNote.title);
                      setEditContent(activeNote.content);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary border border-border hover:bg-zinc-800 text-foreground text-xs font-semibold rounded-xl transition-all"
                  >
                    <Eye className="h-3.5 w-3.5" /> Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleToggleSpeech}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 border border-border text-foreground text-xs font-semibold rounded-xl transition-all ${
                      isSpeaking ? 'bg-violet-500/15 hover:bg-violet-500/25' : 'bg-secondary hover:bg-zinc-800'
                    }`}
                    title={isSpeaking ? "Stop reading" : "Read aloud"}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-violet-400 animate-pulse" /> Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-primary" /> Read Aloud
                      </>
                    )}
                  </button>

                  {isSpeaking && (
                    <>
                      <button
                        onClick={handlePauseResume}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary border border-border hover:bg-zinc-800 text-foreground text-xs font-semibold rounded-xl transition-all"
                        title={speechPaused ? 'Resume' : 'Pause'}
                      >
                        {speechPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5 text-amber-400" />}
                      </button>
                      <button
                        onClick={cycleSpeed}
                        className="px-2.5 py-1.5 bg-secondary border border-border hover:bg-zinc-800 text-[11px] font-bold text-muted-foreground rounded-xl transition-all min-w-[40px]"
                        title="Change speed"
                      >
                        {speechRate}x
                      </button>
                      {voices.length > 0 && (
                        <select
                          value={selectedVoiceURI}
                          onChange={(e) => handleVoiceChange(e.target.value)}
                          className="bg-secondary hover:bg-zinc-800 text-xs font-semibold text-muted-foreground hover:text-foreground py-1.5 px-2.5 rounded-xl border border-border cursor-pointer max-w-[120px] truncate focus:outline-none"
                          title="Select voice"
                        >
                          {voices.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI} className="bg-zinc-900 text-foreground">
                              {v.name.replace('Microsoft', 'MS').replace('Google', 'Google')}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                  
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary border border-border hover:bg-zinc-800 text-foreground text-xs font-semibold rounded-xl transition-all"
                  >
                    <Edit className="h-3.5 w-3.5 text-primary" /> Edit Notes
                  </button>
                  
                  <button
                    onClick={() => handleDeleteNote(activeNote._id)}
                    className="p-1.5 border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {editMode ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1 font-semibold">Note Title:</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1 font-semibold">Content (Markdown Format):</label>
                <textarea
                  rows={15}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">{activeNote.title}</h2>
              <div className="prose dark:prose-invert max-w-none">
                {renderNotesMarkdown(activeNote.content)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 2. GENERAL NOTEBOOKS LIST */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Note Generator Box */}
          <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 shadow-sm h-fit">
            <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Synthesize Notes
            </h2>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Source Document:</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-secondary border border-border text-foreground text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">-- Choose Document --</option>
                  {documents.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={generating || documents.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" /> Synthesizing...
                  </>
                ) : (
                  <>Create Study Notes</>
                )}
              </button>
            </form>
            {documents.length === 0 && (
              <p className="text-xs text-amber-500 mt-3 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Upload a PDF to start summarizing.
              </p>
            )}
          </div>

          {/* Notebook list panel */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-base">My Notebooks</h2>
            </div>

            {loading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
                <p className="text-sm">Loading folders...</p>
              </div>
            ) : notesList.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold mb-1">No notes generated yet</p>
                <p className="text-xs">Submit processed materials to initiate AI chapter summary extractions.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notesList.map((note) => (
                  <div 
                    key={note._id} 
                    onClick={() => handleViewNote(note)}
                    className="p-4 flex items-center justify-between hover:bg-secondary/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0 mr-4">
                      <div className="h-10 w-10 shrink-0 bg-fuchsia-500/10 rounded-xl flex items-center justify-center text-fuchsia-500">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate block">{note.title}</span>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          Last edited {new Date(note.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={(e) => handleDeleteNote(note._id, e)}
                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
