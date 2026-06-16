import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { HelpCircle, Sparkles, Loader2, Play, Timer, Check, X, AlertTriangle, FileText, RotateCcw, Trash2 } from 'lucide-react';

interface QuizQuestion {
  _id: string;
  questionText: string;
  type: 'mcq' | 'true-false' | 'short-answer';
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface UserAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

interface Quiz {
  _id: string;
  title: string;
  questions: QuizQuestion[];
  duration: number;
  score: number;
  completed: boolean;
  userAnswers: UserAnswer[];
  createdAt: string;
}

interface DocumentOption {
  _id: string;
  name: string;
}
const ConfettiCanvas: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];
    const particles: any[] = [];

    // Create particles at multiple source points (left and right edges shooting inwards)
    for (let i = 0; i < 120; i++) {
      const isLeft = Math.random() > 0.5;
      particles.push({
        x: isLeft ? 0 : width,
        y: height * 0.65,
        vx: isLeft ? Math.random() * 15 + 5 : -Math.random() * 15 - 5,
        vy: -Math.random() * 20 - 5,
        radius: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45; // Gravity
        p.vx *= 0.975; // Friction
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.008;

        if (p.opacity > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
          ctx.restore();
        }
      });

      if (alive) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
};

export const QuizPage: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  
  // Selection states
  const [selectedDocId, setSelectedDocId] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [duration, setDuration] = useState(10);
  
  // App view modes
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  
  // Timers
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Loaders
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDocuments();
    fetchQuizzes();
  }, []);

  // Timer countdown hook
  useEffect(() => {
    if (!activeQuiz || activeQuiz.completed || timeLeft <= 0) {
      if (activeQuiz && !activeQuiz.completed && timeLeft === 0) {
        // Auto submit when time runs out
        handleQuizSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, activeQuiz]);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/documents');
      const readyDocs = response.data.documents.filter((d: any) => d.status === 'ready');
      setDocuments(readyDocs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes');
      setQuizzes(response.data.quizzes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setError('Please select a document to generate a quiz.');
      return;
    }

    setError('');
    setGenerating(true);
    try {
      const response = await api.post('/quizzes/generate', {
        documentId: selectedDocId,
        count: questionCount,
        duration,
      });
      await fetchQuizzes();
      // Start the newly generated quiz immediately
      handleStartQuiz(response.data.quiz);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error generating quiz');
    } finally {
      setGenerating(false);
    }
  };

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setAnswers({});
    setTimeLeft(quiz.duration * 60);
  };

  const handleSelectAnswer = (qId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: answer }));
  };

  const handleQuizSubmit = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);

    const formattedAnswers = activeQuiz.questions.map((q) => ({
      questionId: q._id,
      selectedAnswer: answers[q._id] || '',
    }));

    try {
      const response = await api.post(`/quizzes/${activeQuiz._id}/submit`, {
        answers: formattedAnswers,
      });
      
      // Update active quiz with grading results
      setActiveQuiz(response.data.quiz);
      fetchQuizzes();
      
      window.dispatchEvent(new CustomEvent('addAppNotification', {
        detail: {
          title: 'Quiz Completed!',
          message: `You scored ${response.data.quiz.score}% on "${response.data.quiz.title}".`,
          type: response.data.quiz.score >= 60 ? 'success' : 'warning',
          actionTab: 'quiz'
        }
      }));

      if (response.data.quiz.score >= 60) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error submitting quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetakeQuiz = async (id: string) => {
    try {
      const response = await api.post(`/quizzes/${id}/retake`);
      fetchQuizzes();
      handleStartQuiz(response.data.quiz);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error resetting quiz for retake');
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('Are you sure you want to delete this evaluation attempt?')) return;
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes((prev) => prev.filter((q) => q._id !== id));
      if (activeQuiz && activeQuiz._id === id) {
        setActiveQuiz(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting quiz');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-6">
      <ConfettiCanvas active={showConfetti} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quiz Generator</h1>
        <p className="text-sm text-muted-foreground">Challenge yourself with auto-generated tests covering your upload notes.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* 1. QUIZ RUNNING VIEW */}
      {activeQuiz && !activeQuiz.completed && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="font-bold text-base">{activeQuiz.title}</h2>
              <p className="text-xs text-muted-foreground">{activeQuiz.questions.length} Questions</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-primary font-bold text-sm rounded-xl border border-border">
              <Timer className="h-4 w-4" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="space-y-6">
            {activeQuiz.questions.map((q, qIndex) => (
              <div key={q._id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-2.5">
                  <span className="h-5 w-5 shrink-0 bg-primary/10 text-primary flex items-center justify-center font-bold text-xs rounded-md mt-0.5">
                    {qIndex + 1}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{q.questionText}</p>
                </div>

                {q.type === 'short-answer' ? (
                  <textarea
                    rows={3}
                    placeholder="Type your answer here (grading will check keyword matching)..."
                    value={answers[q._id] || ''}
                    onChange={(e) => handleSelectAnswer(q._id, e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((option) => {
                      const isSelected = answers[q._id] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectAnswer(q._id, option)}
                          className={`text-left px-4 py-3 rounded-xl border text-sm transition-all font-medium ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                              : 'bg-secondary border-border hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                if (confirm('Cancel this quiz attempt? Progress will not be saved.')) {
                  setActiveQuiz(null);
                }
              }}
              className="px-4 py-2 border border-border hover:bg-secondary text-sm font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleQuizSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold rounded-xl shadow-md transition-all hover:scale-[1.02]"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" /> Grading...
                </>
              ) : (
                <>Submit Quiz Answers</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. QUIZ REVIEW VIEW (COMPLETED) */}
      {activeQuiz && activeQuiz.completed && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3 shadow-md">
            <h2 className="font-bold text-lg text-foreground">Quiz Completed!</h2>
            <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 shadow-md">
              <span className="text-2xl font-extrabold text-white">{activeQuiz.score}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              You scored {activeQuiz.score}% on this evaluation.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setActiveQuiz(null)}
                className="px-5 py-2.5 bg-secondary border border-border text-foreground hover:bg-secondary/85 text-sm font-semibold rounded-xl shadow-md transition-all hover:scale-[1.02]"
              >
                Return to Generator
              </button>
              <button
                onClick={() => handleRetakeQuiz(activeQuiz._id)}
                className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold rounded-xl shadow-md transition-all hover:scale-[1.02] flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Retake Quiz
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {activeQuiz.questions.map((q, qIndex) => {
              const userAnswer = (activeQuiz.userAnswers || []).find((a) => a.questionId === q._id);
              const isCorrect = userAnswer?.isCorrect || false;
              const selected = userAnswer?.selectedAnswer || '(No Answer)';
              
              return (
                <div key={q._id} className={`bg-card border rounded-2xl p-5 shadow-sm space-y-4 ${
                  isCorrect ? 'border-emerald-500/20' : 'border-red-500/20'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`h-5 w-5 shrink-0 flex items-center justify-center font-bold text-xs rounded-md mt-0.5 ${
                      isCorrect ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {qIndex + 1}
                    </span>
                    <p className="text-sm font-semibold text-foreground">{q.questionText}</p>
                  </div>

                  <div className="text-xs space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-secondary rounded-xl border border-border">
                        <span className="text-muted-foreground block mb-0.5">Your Response:</span>
                        <div className="flex items-center gap-1.5">
                          {isCorrect ? (
                            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={`font-semibold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {selected}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-secondary rounded-xl border border-border">
                        <span className="text-muted-foreground block mb-0.5">Correct Answer:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">{q.correctAnswer}</span>
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/10">
                        <span className="text-violet-500 dark:text-violet-400 block font-semibold mb-0.5">Tutor Explanation:</span>
                        <p className="text-zinc-700 dark:text-zinc-300 font-normal leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. GENERATOR VIEW */}
      {!activeQuiz && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator Form */}
          <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 shadow-sm h-fit">
            <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Create Practice Quiz
            </h2>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Source Material:</label>
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

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Quantity of Questions:</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-secondary border border-border text-foreground text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value={3}>3 Questions</option>
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Duration Timer:</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-secondary border border-border text-foreground text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value={5}>5 Minutes</option>
                  <option value={10}>10 Minutes</option>
                  <option value={20}>20 Minutes</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={generating || documents.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" /> Generating Quiz...
                  </>
                ) : (
                  <>
                    Generate Quiz & Start <Play className="h-4.5 w-4.5 shrink-0" />
                  </>
                )}
              </button>
            </form>
            {documents.length === 0 && (
              <p className="text-xs text-amber-500 mt-3 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Upload PDFs to unlock generation features.
              </p>
            )}
          </div>

          {/* Past Attempt History */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-base">Completed Evaluations</h2>
            </div>

            {loading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
                <p className="text-sm">Loading history...</p>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold mb-1">No quizzes taken yet</p>
                <p className="text-xs">Generate quizzes above to test your recall on the core concepts.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {quizzes.map((quiz) => (
                  <div key={quiz._id} className="p-4 flex items-center justify-between hover:bg-secondary/40 transition-all">
                    <div className="flex items-start gap-3 min-w-0 mr-4">
                      <div className="h-10 w-10 shrink-0 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate block">{quiz.title}</span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{quiz.questions.length} Questions</span>
                          <span>•</span>
                          <span>Taken {new Date(quiz.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-extrabold px-2.5 py-1 rounded-xl ${
                        quiz.score >= 70 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {quiz.score}%
                      </span>
                      <button 
                        onClick={() => handleStartQuiz(quiz)}
                        className="px-3 py-1.5 bg-secondary hover:bg-zinc-800 border border-border text-xs font-semibold rounded-lg transition-all"
                      >
                        Review
                      </button>
                      <button 
                        onClick={() => handleDeleteQuiz(quiz._id)}
                        className="p-1.5 border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete evaluation"
                      >
                        <Trash2 className="h-4 w-4" />
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
