import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, CreditCard, Sparkles, Check, Loader2, Cpu, Zap, HardDrive, RefreshCw, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import { renderAvatar, AVATAR_PRESETS } from '../utils/avatar';


interface OllamaModel {
  name: string;
  size_gb: number;
  size_mb: number;
  family: string;
  parameter_size: string;
  quantization: string;
}

interface ModelsResponse {
  ollama_enabled: boolean;
  ollama_host: string;
  current_chat_model: string;
  current_embed_model: string;
  all_models: OllamaModel[];
  chat_models: OllamaModel[];
  embed_models: OllamaModel[];
}

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || 'default');
  const [tutorPersonality, setTutorPersonality] = useState(user?.tutorPersonality || 'academic');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  // Sync state with user context updates
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatar(user.avatar || 'default');
      setTutorPersonality(user.tutorPersonality || 'academic');
    }
  }, [user]);


  // Model selector state
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedChatModel, setSelectedChatModel] = useState('');
  const [selectedEmbedModel, setSelectedEmbedModel] = useState('');
  const [modelSaving, setModelSaving] = useState(false);
  const [chatDropdownOpen, setChatDropdownOpen] = useState(false);
  const [embedDropdownOpen, setEmbedDropdownOpen] = useState(false);

  // Fetch available models on mount
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const res = await api.get('/settings/models');
      const data: ModelsResponse = res.data;
      setModelsData(data);
      setSelectedChatModel(data.current_chat_model);
      setSelectedEmbedModel(data.current_embed_model);
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSaveModel = async () => {
    if (!modelsData) return;
    
    const hasChanges = 
      selectedChatModel !== modelsData.current_chat_model ||
      selectedEmbedModel !== modelsData.current_embed_model;

    if (!hasChanges) {
      setSuccess('No changes to save.');
      setTimeout(() => setSuccess(''), 2000);
      return;
    }

    setModelSaving(true);
    setError('');
    try {
      const payload: any = {};
      if (selectedChatModel !== modelsData.current_chat_model) {
        payload.chat_model = selectedChatModel;
      }
      if (selectedEmbedModel !== modelsData.current_embed_model) {
        payload.embed_model = selectedEmbedModel;
      }

      const res = await api.post('/settings/models', payload);
      setSuccess(`✅ ${res.data.changes.join(', ')}`);
      
      // Dispatch notification event
      window.dispatchEvent(new CustomEvent('addAppNotification', {
        detail: {
          title: 'AI Model Updated',
          message: res.data.changes.join(', '),
          type: 'success',
        }
      }));

      // Refresh models data
      await fetchModels();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update model.');
    } finally {
      setModelSaving(false);
    }
  };

  // Real profile details update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/update-profile', { 
        name: name.trim(),
        avatar: avatar,
        tutorPersonality: tutorPersonality
      });
      await refreshUser();
      setSuccess('Account profile updated successfully.');
      
      // Dispatch notification event
      window.dispatchEvent(new CustomEvent('addAppNotification', {
        detail: {
          title: 'Profile Updated',
          message: 'Saved name, avatar, and AI study assistant preferences.',
          type: 'success',
        }
      }));

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update details.');
    } finally {
      setLoading(false);
    }
  };

  // Real subscription upgrade toggle
  const handleUpgrade = async () => {
    setError('');
    setUpgrading(true);
    try {
      await api.post('/auth/upgrade');
      setSuccess('Congratulations! You have upgraded to Premium Plan.');
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Subscription upgrade failed.');
    } finally {
      setUpgrading(false);
    }
  };

  const formatSize = (model: OllamaModel) => {
    return model.size_gb >= 1 ? `${model.size_gb} GB` : `${model.size_mb} MB`;
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your credentials, AI model preferences, and study dashboard access.</p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  AI MODEL SELECTOR CARD                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Cpu className="h-5 w-5 text-violet-500" />
            AI Model Selection
          </h3>
          <button
            onClick={fetchModels}
            disabled={modelsLoading}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
            title="Refresh model list"
          >
            <RefreshCw className={`h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {modelsLoading && !modelsData ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Detecting installed models...</span>
          </div>
        ) : !modelsData?.ollama_enabled ? (
          <div className="p-4 bg-amber-950/30 border border-amber-500/20 rounded-xl text-sm text-amber-400">
            <p className="font-semibold">Ollama is not enabled</p>
            <p className="text-xs text-amber-400/70 mt-1">Set <code className="bg-amber-900/40 px-1 py-0.5 rounded">USE_OLLAMA=true</code> in your backend <code>.env</code> file.</p>
          </div>
        ) : (
          <>
            {/* Status badge */}
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-medium">Ollama Online</span>
              <span className="text-muted-foreground">• {modelsData.ollama_host}</span>
              <span className="text-muted-foreground">• {modelsData.all_models.length} models installed</span>
            </div>

            {/* Chat Model Selector */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-fuchsia-400" />
                Chat / Reasoning Model
              </label>
              <div className="relative">
                <button
                  onClick={() => { setChatDropdownOpen(!chatDropdownOpen); setEmbedDropdownOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground hover:border-violet-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      AI
                    </div>
                    <div className="text-left">
                      <span className="font-semibold block">{selectedChatModel}</span>
                      {modelsData.chat_models.find(m => m.name === selectedChatModel) && (
                        <span className="text-[10px] text-muted-foreground">
                          {modelsData.chat_models.find(m => m.name === selectedChatModel)?.parameter_size} • {formatSize(modelsData.chat_models.find(m => m.name === selectedChatModel)!)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${chatDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {chatDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                    {modelsData.chat_models.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">No chat models found. Pull one with <code>ollama pull llama3</code></div>
                    ) : (
                      modelsData.chat_models.map((m) => (
                        <button
                          key={m.name}
                          onClick={() => { setSelectedChatModel(m.name); setChatDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/60 transition-colors text-sm ${
                            selectedChatModel === m.name ? 'bg-violet-500/10 border-l-2 border-violet-500' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm ${
                              selectedChatModel === m.name 
                                ? 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white' 
                                : 'bg-secondary text-muted-foreground'
                            }`}>
                              AI
                            </div>
                            <div>
                              <span className="font-medium block text-foreground">{m.name}</span>
                              <span className="text-[10px] text-muted-foreground">{m.family} • {m.parameter_size} • {m.quantization}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{formatSize(m)}</span>
                            {selectedChatModel === m.name && <Check className="h-4 w-4 text-violet-500" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Embedding Model Selector */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
                Embedding Model (for document search)
              </label>
              <div className="relative">
                <button
                  onClick={() => { setEmbedDropdownOpen(!embedDropdownOpen); setChatDropdownOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      EM
                    </div>
                    <div className="text-left">
                      <span className="font-semibold block">{selectedEmbedModel}</span>
                      {modelsData.embed_models.find(m => m.name === selectedEmbedModel) && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatSize(modelsData.embed_models.find(m => m.name === selectedEmbedModel)!)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${embedDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {embedDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                    {modelsData.embed_models.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">No embedding models found. Pull one with <code>ollama pull nomic-embed-text</code></div>
                    ) : (
                      modelsData.embed_models.map((m) => (
                        <button
                          key={m.name}
                          onClick={() => { setSelectedEmbedModel(m.name); setEmbedDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/60 transition-colors text-sm ${
                            selectedEmbedModel === m.name ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm ${
                              selectedEmbedModel === m.name 
                                ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white' 
                                : 'bg-secondary text-muted-foreground'
                            }`}>
                              EM
                            </div>
                            <div>
                              <span className="font-medium block text-foreground">{m.name}</span>
                              <span className="text-[10px] text-muted-foreground">{m.family} • {m.quantization || 'default'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{formatSize(m)}</span>
                            {selectedEmbedModel === m.name && <Check className="h-4 w-4 text-cyan-500" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveModel}
              disabled={modelSaving || (selectedChatModel === modelsData.current_chat_model && selectedEmbedModel === modelsData.current_embed_model)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-violet-500/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {modelSaving ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Apply Model Changes
                </>
              )}
            </button>

            {/* Helper tip */}
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              💡 <strong>Want more models?</strong> Run <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">ollama pull &lt;model-name&gt;</code> in your terminal, then hit refresh.
              Popular: <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">llama3.2:1b</code> (fast), <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">mistral</code>, <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">phi3</code>, <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">gemma2</code>
            </p>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  PROFILE DETAILS CARD                                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4">
          {renderAvatar(avatar, name || user?.name, "h-16 w-16 text-xl")}
          <div>
            <h2 className="font-bold text-lg text-foreground">{user?.name}</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleUpdateProfile} className="space-y-6 pt-2 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Display Name:</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <User className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Email Address:</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full pl-9 pr-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground font-medium cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2 font-medium">Profile Avatar Preset:</label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = avatar === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAvatar(preset.id)}
                    className={`relative p-1 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : 'opacity-75 hover:opacity-100'
                    }`}
                    title={preset.name}
                  >
                    {renderAvatar(preset.id, name || user?.name, "h-11 w-11 text-xs")}
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-violet-500" />
                AI Tutor Personality
              </h4>
              <p className="text-xs text-muted-foreground">Customize your AI study buddy's teaching and response style.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'academic',
                  name: 'Academic Scholar',
                  description: 'Detailed, rigorous, and direct textbook answers. Default scholarly tone.',
                  badge: 'Direct'
                },
                {
                  id: 'socratic',
                  name: 'Socratic Guide',
                  description: 'Asks guiding, thought-provoking questions. Leads you to discover answers yourself.',
                  badge: 'Guiding'
                },
                {
                  id: 'eli5',
                  name: 'ELI5 Explainer',
                  description: 'Explains complex topics using simple analogies and stories. Ideal for fresh learning.',
                  badge: 'Analogies'
                },
                {
                  id: 'coach',
                  name: 'Exam Prep Coach',
                  description: 'Focuses on mnemonics, quick formulas, summaries, and revision pointers.',
                  badge: 'Fast Prep'
                }
              ].map((personality) => {
                const isSelected = tutorPersonality === personality.id;
                return (
                  <button
                    key={personality.id}
                    type="button"
                    onClick={() => setTutorPersonality(personality.id)}
                    className={`text-left p-4 rounded-2xl border text-xs flex flex-col justify-between h-36 transition-all hover:bg-secondary/40 hover:scale-[1.01] active:scale-[0.99] ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/5 dark:bg-violet-500/10 shadow-md ring-1 ring-violet-500'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-sm">{personality.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isSelected ? 'bg-violet-500/20 text-violet-400' : 'bg-secondary text-muted-foreground'
                        }`}>
                          {personality.badge}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed text-[11px]">
                        {personality.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1 text-[10px] text-violet-400 font-semibold mt-2">
                        <Check className="h-3.5 w-3.5" />
                        Active Personality Mode
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-xl disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin h-3.5 w-3.5" />
            ) : (
              'Save Profile Settings'
            )}
          </button>
        </form>
      </div>

      {/* Subscription Tier Box */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-violet-500" />
          Subscription Tier
        </h3>

        {user?.subscriptionStatus === 'premium' ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
            <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-bold text-emerald-500 block">Premium Plan Activated</span>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-normal mt-0.5">
                You have unrestricted AI document query usage, flashcard indexing, and quiz generation limits. Thank you for studying with us!
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-2xl space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-violet-500 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="text-sm font-bold text-foreground block">Free Plan Tier</span>
                <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                  Standard account indexing limits. Upgrade to Premium to unlock unlimited vector processing and faster response generations.
                </p>
              </div>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-violet-500/20 active:scale-[0.98]"
            >
              {upgrading ? (
                <Loader2 className="animate-spin h-3.5 w-3.5" />
              ) : (
                'Upgrade to Premium ($9.99/mo)'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
