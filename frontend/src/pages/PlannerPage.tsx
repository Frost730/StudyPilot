import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Calendar, Sparkles, Loader2, CheckSquare, Square, Award, BookOpen, AlertTriangle, Trash2 } from 'lucide-react';

interface WeeklyGoal {
  weekNumber: number;
  goal: string;
}

interface ScheduleBlock {
  _id: string;
  day: string;
  topic: string;
  tasks: string[];
  completed: boolean;
}

interface StudyPlan {
  _id: string;
  title: string;
  examDate: string;
  topics: string[];
  dailyStudyHours: number;
  weeklyGoals: WeeklyGoal[];
  schedule: ScheduleBlock[];
  revisionPlan: string;
  completed: boolean;
  createdAt?: string;
}

export const PlannerPage: React.FC = () => {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  
  // Form parameters
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [topics, setTopics] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  
  // UI States
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/planner');
      setPlans(response.data.plans);
      if (response.data.plans.length > 0 && !activePlan) {
        setActivePlan(response.data.plans[0]);
      }
      checkBehindSchedulePlans(response.data.plans);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkBehindSchedulePlans = (studyPlans: StudyPlan[]) => {
    const notifiedStr = sessionStorage.getItem('notified_behind_plans') || '[]';
    const notifiedList: string[] = JSON.parse(notifiedStr);
    const newNotified = [...notifiedList];
    let dispatched = false;

    studyPlans.forEach((plan) => {
      if (plan.completed) return;
      if (notifiedList.includes(plan._id)) return;
      
      const examDateObj = new Date(plan.examDate);
      const createdDateObj = plan.createdAt ? new Date(plan.createdAt) : new Date(Date.now() - 24 * 3600 * 1000);
      const currentDateObj = new Date();
      
      const totalTime = examDateObj.getTime() - createdDateObj.getTime();
      const elapsedTime = currentDateObj.getTime() - createdDateObj.getTime();
      
      if (totalTime <= 0) return;
      
      const elapsedRatio = Math.max(0, Math.min(1, elapsedTime / totalTime));
      
      const totalTasks = plan.schedule.length;
      const completedTasks = plan.schedule.filter((s) => s.completed).length;
      const completionRatio = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
      
      if (completionRatio < elapsedRatio - 0.05) {
        const percentBehind = Math.round((elapsedRatio - completionRatio) * 100);
        
        window.dispatchEvent(new CustomEvent('addAppNotification', {
          detail: {
            title: 'Behind Study Schedule!',
            message: `You are behind on your "${plan.title}" plan by approx. ${percentBehind}%. Review your study blocks!`,
            type: 'error',
            actionTab: 'planner'
          }
        }));
        
        newNotified.push(plan._id);
        dispatched = true;
      }
    });

    if (dispatched) {
      sessionStorage.setItem('notified_behind_plans', JSON.stringify(newNotified));
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate || !topics.trim()) {
      setError('Exam date and topics are required.');
      return;
    }

    setError('');
    setGenerating(true);
    try {
      const response = await api.post('/planner/generate', {
        title: title.trim() || undefined,
        examDate,
        topics: topics.split(',').map((t) => t.trim()),
        dailyStudyHours: dailyHours,
      });
      
      const newPlan = response.data.plan;
      setPlans((prev) => [newPlan, ...prev]);
      setActivePlan(newPlan);
      
      // Reset form
      setTitle('');
      setExamDate('');
      setTopics('');
      setDailyHours(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error generating plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleTask = async (blockId: string) => {
    if (!activePlan) return;
    try {
      const response = await api.patch(`/planner/${activePlan._id}/task/${blockId}`);
      setActivePlan(response.data.plan);
      setPlans((prev) =>
        prev.map((p) => (p._id === activePlan._id ? response.data.plan : p))
      );
    } catch (err) {
      console.error('Error toggling task status:', err);
    }
  };

  const handleFinishPlan = async (id: string) => {
    try {
      const response = await api.post(`/planner/${id}/finish`);
      const updatedPlan = response.data.plan;
      setPlans((prev) =>
        prev.map((p) => (p._id === id ? updatedPlan : p))
      );
      if (activePlan && activePlan._id === id) {
        setActivePlan(updatedPlan);
      }
    } catch (err) {
      console.error('Error toggling study plan completion:', err);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this study plan?')) return;
    try {
      await api.delete(`/planner/${id}`);
      const remainingPlans = plans.filter((p) => p._id !== id);
      setPlans(remainingPlans);
      if (activePlan && activePlan._id === id) {
        setActivePlan(remainingPlans.length > 0 ? remainingPlans[0] : null);
      }
    } catch (err) {
      console.error('Error deleting study plan:', err);
    }
  };

  // Calculate plan task completion
  const totalTasks = activePlan?.schedule.length || 0;
  const completedTasks = activePlan?.schedule.filter((s) => s.completed).length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Study Planner</h1>
        <p className="text-sm text-muted-foreground">Keep your revisions organized with automated weekly goals and schedules leading to your exams.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Planner Input Block */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Configure Study Plan
            </h2>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Subject / Exam Name:</label>
                <input
                  type="text"
                  placeholder="e.g. CS302 Operating Systems"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Target Exam Date:</label>
                <input
                  type="date"
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Revisions Topics (comma separated):</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Scheduling Algorithms, Memory Management, Process Control Block, Deadlocks..."
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Daily Commitment (hours):</label>
                <select
                  value={dailyHours}
                  onChange={(e) => setDailyHours(Number(e.target.value))}
                  className="w-full bg-secondary border border-border text-foreground text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value={1}>1 hour / day</option>
                  <option value={2}>2 hours / day</option>
                  <option value={4}>4 hours / day</option>
                  <option value={6}>6 hours / day</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold rounded-xl transition-all shadow-md shadow-primary/20"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" /> Generating Schedule...
                  </>
                ) : (
                  <>Create Study Schedule</>
                )}
              </button>
            </form>
          </div>

          {/* List of study plans */}
          {plans.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">Your Schedules</h3>
              <div className="space-y-2">
                {plans.map((p) => {
                  const isSelected = activePlan?._id === p._id;
                  return (
                    <div 
                      key={p._id} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-secondary border-primary/20 text-primary font-bold shadow-sm'
                          : 'bg-card border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20'
                      }`}
                    >
                      <button
                        onClick={() => setActivePlan(p)}
                        className="flex-1 text-left truncate min-w-0"
                      >
                        <span className={`block truncate ${p.completed ? 'line-through text-muted-foreground/60' : ''}`}>
                          {p.title}
                        </span>
                        {p.completed && (
                          <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                            Completed
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => handleFinishPlan(p._id)}
                          className={`p-1 rounded-lg transition-all ${
                            p.completed 
                              ? 'text-emerald-500 hover:bg-emerald-500/10' 
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                          }`}
                          title={p.completed ? 'Mark plan active' : 'Mark plan as completed'}
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(p._id)}
                          className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete plan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Schedule Display Board */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="py-24 text-center text-muted-foreground flex flex-col items-center justify-center bg-card border border-border rounded-2xl">
              <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
              <p className="text-sm">Fetching study planners...</p>
            </div>
          ) : !activePlan ? (
            <div className="border border-border bg-card/40 rounded-2xl py-24 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-sm mb-1">No Study Plans Active</p>
              <p className="text-xs px-6">Input your target exam date and subjects to spawn a custom study calendar.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Panel */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-base text-foreground truncate">{activePlan.title}</h2>
                    {activePlan.completed && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exam Date: {new Date(activePlan.examDate).toLocaleDateString()} • {activePlan.dailyStudyHours} hours daily
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleFinishPlan(activePlan._id)}
                    className={`px-3 py-1.5 border text-xs font-semibold rounded-lg transition-all ${
                      activePlan.completed
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold'
                        : 'bg-secondary hover:bg-zinc-800 border-border text-foreground'
                    }`}
                  >
                    {activePlan.completed ? 'Completed' : 'Mark Completed'}
                  </button>
                  
                  <button
                    onClick={() => handleDeletePlan(activePlan._id)}
                    className="p-2 border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  
                  <div className="w-32 space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span className="text-muted-foreground">Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-300 rounded-full" 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Goals list */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Award className="h-4.5 w-4.5 text-violet-500" />
                  Weekly Milestones
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {activePlan.weeklyGoals.map((w) => (
                    <div key={w.weekNumber} className="p-3 bg-secondary rounded-xl border border-border flex items-start gap-2.5">
                      <span className="h-5 w-5 shrink-0 bg-violet-500/10 text-violet-400 font-bold text-xs flex items-center justify-center rounded-md mt-0.5">
                        W{w.weekNumber}
                      </span>
                      <p className="text-xs text-foreground dark:text-zinc-300 leading-normal font-normal">{w.goal}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day calendar listing */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <BookOpen className="h-4.5 w-4.5 text-violet-500" />
                  Study Schedule Blocks
                </h3>
                
                <div className="space-y-3">
                  {activePlan.schedule.map((block) => (
                    <div 
                      key={block._id}
                      onClick={() => handleToggleTask(block._id)}
                      className={`bg-card border rounded-2xl p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-all select-none ${
                        block.completed ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="shrink-0 mt-0.5 text-primary">
                          {block.completed ? (
                            <CheckSquare className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-primary uppercase">{block.day}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-semibold text-foreground truncate">{block.topic}</span>
                          </div>

                          <div className="mt-2 pl-1.5 border-l border-border space-y-1">
                            {block.tasks.map((task, idx) => (
                              <span 
                                key={idx} 
                                className={`text-xs block ${block.completed ? 'line-through text-muted-foreground' : 'text-foreground dark:text-zinc-300'}`}
                              >
                                - {task}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revision plan */}
              {activePlan.revisionPlan && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-500 uppercase block mb-0.5">Pre-Exam Revision Guide:</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-normal">{activePlan.revisionPlan}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
