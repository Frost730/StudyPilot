import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Upload, Trash2, Edit3, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';

interface Document {
  _id: string;
  name: string;
  size: number;
  status: 'processing' | 'ready' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Renaming state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Fetch documents list
  const fetchDocuments = async () => {
    try {
      const response = await api.get('/documents');
      setDocuments(response.data.documents);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDocuments().finally(() => setLoading(false));
  }, []);

  // Poll documents if any are in 'processing' status
  useEffect(() => {
    const hasProcessing = documents.some((doc) => doc.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      const oldDocs = [...documents];
      try {
        const response = await api.get('/documents');
        const newDocs = response.data.documents;
        setDocuments(newDocs);
        
        // Find documents that transitioned from processing to ready or failed
        newDocs.forEach((newD: any) => {
          const oldD = oldDocs.find((o) => o._id === newD._id);
          if (oldD && oldD.status === 'processing' && newD.status !== 'processing') {
            window.dispatchEvent(new CustomEvent('addAppNotification', {
              detail: {
                title: newD.status === 'ready' ? 'Document Indexed!' : 'Indexing Failed',
                message: newD.status === 'ready' 
                  ? `"${newD.name}" is now ready for RAG AI query access.`
                  : `Failed to process "${newD.name}": ${newD.errorMessage || 'Unknown error'}`,
                type: newD.status === 'ready' ? 'success' : 'error',
                actionTab: 'chat'
              }
            }));
          }
        });
      } catch (err) {
        console.error('Error polling documents:', err);
      }
    }, 3000); // Poll every 3s

    return () => clearInterval(interval);
  }, [documents]);

  // Handle file upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress progression
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess('Document uploaded successfully! Indexing text chunks...');
      fetchDocuments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error uploading document');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  // Rename document
  const handleRename = async (id: string) => {
    if (!newName.trim()) return;
    try {
      await api.patch(`/documents/${id}`, { name: newName.trim() });
      setRenamingId(null);
      setNewName('');
      fetchDocuments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error renaming document');
    }
  };

  // Delete document
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document? All associated study notes, quiz logs, and chat contexts will be lost.')) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocuments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting document');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Documents</h1>
          <p className="text-sm text-muted-foreground">Upload and manage notes, textbook sections, or research papers for RAG AI query access.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="border-2 border-dashed border-border hover:border-primary/50 transition-all rounded-2xl p-8 bg-card flex flex-col items-center justify-center text-center relative overflow-hidden group">
        <Upload className="h-10 w-10 text-muted-foreground mb-4 group-hover:text-primary group-hover:scale-110 transition-all" />
        <p className="text-sm font-semibold mb-1">Drag and drop your PDF textbooks or notes here</p>
        <p className="text-xs text-muted-foreground mb-4">Supported formats: PDF (up to 10MB)</p>
        
        <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-4 py-2 rounded-xl text-sm font-medium shadow-md shadow-primary/20">
          Browse Files
          <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
        </label>

        {uploading && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center p-6">
            <Loader2 className="animate-spin h-8 w-8 text-primary mb-3" />
            <p className="text-sm font-semibold mb-2">Processing upload files...</p>
            <div className="w-64 bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-base">Uploaded Files</h2>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="animate-spin h-8 w-8 mb-2 text-primary" />
            <p className="text-sm">Loading document inventory...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold mb-1">No documents uploaded yet</p>
            <p className="text-xs">Upload your study resources above to initiate AI conversations and test generators.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div key={doc._id} className="p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors">
                <div className="flex items-start gap-3 flex-1 min-w-0 mr-4">
                  <div className="h-10 w-10 shrink-0 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {renamingId === doc._id ? (
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(doc._id)}
                          className="bg-primary hover:bg-primary/95 text-white px-2.5 py-1 rounded-lg text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="text-muted-foreground hover:text-foreground text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate block">{doc.name}</span>
                        <button 
                          onClick={() => {
                            setRenamingId(doc._id);
                            setNewName(doc.name);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-zinc-800 rounded transition-all"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{formatSize(doc.size)}</span>
                      <span>•</span>
                      <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      {doc.status === 'processing' && (
                        <span className="text-amber-500 flex items-center gap-1">
                          <Loader2 className="animate-spin h-3.5 w-3.5" /> Processing...
                        </span>
                      )}
                      {doc.status === 'ready' && (
                        <span className="text-emerald-500 flex items-center gap-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                        </span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="text-red-500 flex items-center gap-0.5" title={doc.errorMessage}>
                          <AlertCircle className="h-3.5 w-3.5" /> Failed indexing
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => handleDelete(doc._id)}
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
  );
};
