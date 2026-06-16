import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { BarChart2, BookOpen, MessageSquare, FileText, Layers, Award, Loader2, Calendar, CheckSquare, Sparkles } from 'lucide-react';

interface FlashcardStats {
  total: number;
  learned: number;
  reviewPending: number;
}

interface RecentAttempt {
  id: string;
  title: string;
  score: number;
  completedAt: string;
}

interface QuizStats {
  totalTaken: number;
  averageScore: number;
  recentAttempts: RecentAttempt[];
}

interface PlannerStats {
  totalPlans: number;
  completedPlans: number;
  totalTasks: number;
  completedTasks: number;
  dailyHoursCommitment: number;
  uniqueTopicsCount: number;
  topicsList: string[];
}

interface Analytics {
  documentsUploaded: number;
  questionsAsked: number;
  notesGenerated: number;
  flashcards: FlashcardStats;
  quizzes: QuizStats;
  planner: PlannerStats;
}

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics')
      .then((res) => {
        setData(res.data.analytics);
      })
      .catch((err) => {
        console.error('Error loading analytics:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
        <p className="text-sm">Calculating study stats...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-semibold">Failed to load analytics</p>
      </div>
    );
  }

  // Draw circular progress svg variables
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const cardsPercent = data.flashcards.total > 0 ? (data.flashcards.learned / data.flashcards.total) : 0;
  const strokeDashoffset = circumference - cardsPercent * circumference;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics Center</h1>
        <p className="text-sm text-muted-foreground">Track your studying consistency, card retention, and quiz achievements in real-time.</p>
      </div>

      {/* Main KPI Stats Block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Docs count */}
        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.02] transition-all">
          <div className="h-10 w-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-0.5">Documents Indexed</span>
            <span className="text-2xl font-extrabold text-foreground">{data.documentsUploaded}</span>
          </div>
        </div>

        {/* Chat questions */}
        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.02] transition-all">
          <div className="h-10 w-10 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500 shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-0.5">Questions Answered</span>
            <span className="text-2xl font-extrabold text-foreground">{data.questionsAsked}</span>
          </div>
        </div>

        {/* Notes compiled */}
        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.02] transition-all">
          <div className="h-10 w-10 bg-fuchsia-500/10 rounded-xl flex items-center justify-center text-fuchsia-500 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-0.5">AI Notes Created</span>
            <span className="text-2xl font-extrabold text-foreground">{data.notesGenerated}</span>
          </div>
        </div>

        {/* Quiz average score */}
        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.02] transition-all">
          <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-0.5">Quiz Success Rate</span>
            <span className="text-2xl font-extrabold text-foreground">{data.quizzes.averageScore}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Flashcard Retention Visual (Circular SVG) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-1">
              <Layers className="h-4.5 w-4.5 text-primary" /> Flashcard Retention
            </h3>
            <p className="text-xs text-muted-foreground">Percentage of deck cards tagged as memorized.</p>
          </div>

          <div className="flex items-center justify-center py-6 gap-6">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-full w-full -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-secondary"
                />
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-foreground">
                  {data.flashcards.total > 0 ? Math.round(cardsPercent * 100) : 0}%
                </span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground">Learned</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-primary rounded-md shrink-0" />
                <span className="text-muted-foreground">Memorized: <strong className="text-foreground font-semibold">{data.flashcards.learned}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-secondary rounded-md shrink-0" />
                <span className="text-muted-foreground">Review: <strong className="text-foreground font-semibold">{data.flashcards.reviewPending}</strong></span>
              </div>
              <div className="border-t border-border pt-1.5 flex items-center gap-2">
                <span className="text-muted-foreground">Total Deck Size: <strong className="text-foreground font-semibold">{data.flashcards.total}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Visual SVG/CSS Quiz scores chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-1">
              <BarChart2 className="h-4.5 w-4.5 text-primary" /> Evaluation History
            </h3>
            <p className="text-xs text-muted-foreground">Score trends across your 5 most recent evaluations.</p>
          </div>

          <div className="flex-1 flex items-end justify-between gap-4 h-36 px-2 pt-6">
            {data.quizzes.recentAttempts.length === 0 ? (
              <div className="w-full text-center py-8 text-xs text-muted-foreground">
                No evaluation attempts completed yet.
              </div>
            ) : (
              // Map recent attempts to vertical bars
              data.quizzes.recentAttempts.map((attempt, idx) => {
                const barHeight = Math.max(12, attempt.score); // Guarantee a small visible bar if score is 0
                return (
                  <div key={attempt.id} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <span className="text-[10px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {attempt.score}%
                    </span>
                    <div 
                      style={{ height: `${barHeight}%` }}
                      className="w-full bg-gradient-to-t from-violet-600 to-fuchsia-600 rounded-lg group-hover:from-violet-500 group-hover:to-fuchsia-500 transition-all duration-300 shadow-md shadow-violet-500/10"
                    />
                    <span className="text-[9px] uppercase font-bold text-muted-foreground shrink-0">
                      T{data.quizzes.recentAttempts.length - idx}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Recent Quiz Logs */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
              <Award className="h-4.5 w-4.5 text-primary" /> Evaluation Feed
            </h3>
            
            {data.quizzes.recentAttempts.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                Feed is empty.
              </div>
            ) : (
              <div className="space-y-3.5">
                {data.quizzes.recentAttempts.slice(0, 3).map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between text-xs py-1 border-b border-secondary last:border-0 last:pb-0">
                    <div className="min-w-0 pr-3">
                      <span className="font-semibold text-foreground truncate block">{attempt.title}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {new Date(attempt.completedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <span className={`font-bold shrink-0 px-2 py-0.5 rounded-lg ${
                      attempt.score >= 70
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      {attempt.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 2. Study Plan Progress Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Planner Overview KPI */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between md:col-span-1">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-1">
              <Calendar className="h-4.5 w-4.5 text-primary" /> Study Planner Stats
            </h3>
            <p className="text-xs text-muted-foreground">Active plans and daily study commitments.</p>
          </div>
          
          <div className="space-y-4 pt-4 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-secondary">
              <span className="text-muted-foreground">Total Generated Plans:</span>
              <span className="font-bold text-foreground">{data.planner.totalPlans}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-secondary">
              <span className="text-muted-foreground">Completed Plans:</span>
              <span className="font-bold text-emerald-500">{data.planner.completedPlans}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-secondary">
              <span className="text-muted-foreground">Daily Commitment:</span>
              <span className="font-bold text-violet-500">{data.planner.dailyHoursCommitment} hrs/day</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Unique Study Topics:</span>
              <span className="font-bold text-foreground">{data.planner.uniqueTopicsCount}</span>
            </div>
          </div>
        </div>

        {/* Schedule Task Completion progress */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between md:col-span-1">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-1">
              <CheckSquare className="h-4.5 w-4.5 text-primary" /> Task Completion Rate
            </h3>
            <p className="text-xs text-muted-foreground">Ratio of calendar study blocks completed.</p>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center py-4 space-y-3">
            <div className="w-full bg-secondary h-3.5 rounded-full overflow-hidden relative shadow-inner">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${data.planner.totalTasks > 0 ? Math.round((data.planner.completedTasks / data.planner.totalTasks) * 100) : 0}%` }}
              />
            </div>
            <div className="text-center text-xs font-semibold">
              <span className="text-foreground">
                {data.planner.completedTasks} / {data.planner.totalTasks} Tasks ({data.planner.totalTasks > 0 ? Math.round((data.planner.completedTasks / data.planner.totalTasks) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>

        {/* Topics List Coverage */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between md:col-span-1">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2">
              <Sparkles className="h-4.5 w-4.5 text-primary" /> Curated Topics List
            </h3>
            <p className="text-xs text-muted-foreground">Subjects covered by your AI-generated planners.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[140px] pt-3 pr-1">
            {data.planner.topicsList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No topics scheduled yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.planner.topicsList.map((topic, i) => (
                  <span 
                    key={i} 
                    className="text-[10px] bg-secondary border border-border text-foreground px-2 py-1 rounded-lg font-medium"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
