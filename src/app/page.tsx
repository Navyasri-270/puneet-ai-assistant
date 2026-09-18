'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Plus, 
  Filter, 
  Check, 
  Send,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Mail,
  Bell
} from 'lucide-react';
import { getLocalDateStr } from '@/lib/calendarService';
import { formatDate, formatTime, setUserTimezone } from '@/lib/dateUtils';
import { useMounted, useExecutiveTimezone } from '@/lib/useExecutiveTimezone';
import VoiceInput from '@/components/VoiceInput';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  category: string;
  notes?: string;
}

export default function Dashboard() {
  const { timezone, greeting, mounted: tzMounted } = useExecutiveTimezone();
  const mounted = useMounted();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<string>("");
  const [assistantInput, setAssistantInput] = useState("");
  const [isSubmittingAI, setIsSubmittingAI] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ message: string; intent?: string } | null>(null);

  const [scheduleEvents, setScheduleEvents] = useState<any[]>([]);
  const [emailDraftsCount, setEmailDraftsCount] = useState<number>(0);
  const [mostRecentDraft, setMostRecentDraft] = useState<any | null>(null);
  const [dashboardReminders, setDashboardReminders] = useState<any[]>([]);
  const [briefingData, setBriefingData] = useState<any | null>(null);
  const [isRefreshingBriefing, setIsRefreshingBriefing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const todayStrLocal = getLocalDateStr();

    try {
      await Promise.allSettled([
        fetch('/api/tasks')
          .then(res => res.json())
          .then(data => { if (data.tasks) setTasks(data.tasks); }),

        fetch(`/api/calendar?unified=true&date=${todayStrLocal}`)
          .then(res => res.json())
          .then(data => { if (data.schedule) setScheduleEvents(data.schedule); }),

        fetch('/api/emails')
          .then(res => res.json())
          .then(data => {
            if (data.drafts) {
              setEmailDraftsCount(data.drafts.length);
              setMostRecentDraft(data.drafts[0] || null);
            }
          }),

        fetch('/api/reminders?filter=all')
          .then(res => res.json())
          .then(data => {
            if (data.reminders) {
              setDashboardReminders(data.reminders.filter((r: any) => !r.triggered));
            }
          }),

        fetch('/api/briefing')
          .then(res => res.json())
          .then(data => {
            if (data.briefing) {
              setBriefingData(data.briefing);
              setBriefing(data.briefing.summaryText);
            }
          }),

        fetch('/api/memories?category=Preferences')
          .then(res => res.json())
          .then(data => {
            if (data.memories) {
              const tzMem = data.memories.find((m: any) => m.key === 'timezone');
              if (tzMem && tzMem.value) {
                setUserTimezone(tzMem.value);
              }
            }
          })
      ]);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshBriefing = async () => {
    setIsRefreshingBriefing(true);
    try {
      const res = await fetch('/api/briefing', { method: 'POST' });
      const data = await res.json();
      if (data.briefing) {
        setBriefingData(data.briefing);
        setBriefing(data.briefing.summaryText);
      }
    } catch (err) {
      console.error("Refresh briefing error:", err);
    } finally {
      setIsRefreshingBriefing(false);
    }
  };


  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const [dashboardPendingTask, setDashboardPendingTask] = useState<any | null>(null);

  const handleQuickAISubmit = async (e?: React.FormEvent, selectedPriorityChoice?: string) => {
    if (e) e.preventDefault();
    const promptToSubmit = assistantInput;
    if (!promptToSubmit.trim() && !selectedPriorityChoice && !dashboardPendingTask) return;

    setIsSubmittingAI(true);

    const reqPayload: any = {
      prompt: promptToSubmit || selectedPriorityChoice || "Priority Selection",
      selectedPriority: selectedPriorityChoice,
      pendingTask: dashboardPendingTask
    };

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload)
      });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }

      if (data.intent === 'clarify_priority' && data.data?.pendingTask) {
        setDashboardPendingTask(data.data.pendingTask);
        setAiFeedback({
          message: data.message,
          intent: data.intent,
          options: data.options
        } as any);
      } else {
        setDashboardPendingTask(null);
        setAiFeedback({
          message: data.message || data.actionSummary,
          intent: data.intent
        });
        setAssistantInput("");
      }
    } catch (err) {
      setAiFeedback({ message: "Unable to process request. Please try again." });
    } finally {
      setIsSubmittingAI(false);
    }
  };


  const handleMarkComplete = async (taskId: string) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'Completed' })
      });
      const data = await res.json();
      if (data.task) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Completed' } : t));
      }
    } catch (err) {
      console.error("Task completion failed:", err);
    }
  };

  const getLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr();
  const todayTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate === todayStr);
  const highPriorityToday = todayTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');
  const overdueTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr);
  const upcomingTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate > todayStr);

  const priorityRank: Record<string, number> = { Urgent: 1, High: 2, Medium: 3, Low: 4 };

  const sortedTodayTasks = [...todayTasks].sort((a, b) => {
    const pA = priorityRank[a.priority] || 5;
    const pB = priorityRank[b.priority] || 5;
    if (pA !== pB) return pA - pB;
    return (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59');
  });

  const sortedTodayPriorities = [...highPriorityToday].sort((a, b) => {
    const pA = priorityRank[a.priority] || 5;
    const pB = priorityRank[b.priority] || 5;
    if (pA !== pB) return pA - pB;
    return (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59');
  });

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Medium':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <>
      {/* Executive Welcome & AI Command Banner */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-executive">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {tzMounted ? `${greeting}, Puneet.` : 'Welcome, Puneet.'}
              </h1>
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                Executive Mode
              </span>
              <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-slate-200" title="Active Timezone">
                {tzMounted ? timezone : 'Loading...'}
              </span>
            </div>
            <p className="text-slate-600 text-sm mt-1">
              Here is your real-time executive dashboard and priority matrix.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchDashboardData}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
            <Link 
              href="/assistant"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              Full Assistant Mode
            </Link>
          </div>
        </div>

        {/* Executive Metrics Counter Cards Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>TASKS TODAY</span>
              <CalendarIcon className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{todayTasks.length}</p>
            <p className="text-[11px] text-slate-400 font-medium">Scheduled for {todayStr}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>HIGH PRIORITY</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{highPriorityToday.length}</p>
            <p className="text-[11px] text-slate-400 font-medium">High / Urgent due today</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>UPCOMING</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{upcomingTasks.length}</p>
            <p className="text-[11px] text-slate-400 font-medium">Future scheduled tasks</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>OVERDUE</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-bold text-rose-600">{overdueTasks.length}</p>
            <p className="text-[11px] text-slate-400 font-medium">Incomplete past deadlines</p>
          </div>
        </div>


        {/* Quick Natural Language Assistant Input Bar */}
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-lg">
          <form onSubmit={handleQuickAISubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="quick-assistant-input" className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Tell the assistant what you need done
              </label>
              <span className="text-[11px] text-slate-400">Press Enter or click execute</span>
            </div>
            <div className="relative flex items-center gap-2">
              <input
                id="quick-assistant-input"
                type="text"
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder='e.g. "Remind me tomorrow at 10 AM to follow up with the Dubai leads"'
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3.5 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <VoiceInput
                onTranscript={(trans) => {
                  setAssistantInput(trans);
                }}
                size="md"
              />
              <button
                type="submit"
                disabled={isSubmittingAI || !assistantInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-3.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0"
              >
                {isSubmittingAI ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Execute</span>
                    <Send className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick AI Action Feedback */}
          {aiFeedback && (
            <div className="mt-3 p-3.5 bg-slate-800/90 border border-blue-500/30 rounded-lg text-xs text-blue-200 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white whitespace-pre-line">{aiFeedback.message}</p>
                </div>
              </div>
              {(aiFeedback as any).options && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
                  <span className="text-[11px] text-slate-400 font-semibold self-center">Select Priority:</span>
                  {(aiFeedback as any).options.map((opt: any) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleQuickAISubmit(undefined, opt.title)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-md text-xs transition-colors shadow-sm"
                    >
                      {opt.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* Suggested Quick Prompt Chips */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium text-[11px]">Quick actions:</span>
            {[
              "Remind me tomorrow at 10 AM to follow up with Dubai leads",
              "What do I need to do today?",
              "Move the proposal to Friday",
              "Draft an email to John asking for proposal update"
            ].map((suggested, idx) => (
              <button
                key={idx}
                onClick={() => setAssistantInput(suggested)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded text-[11px] border border-slate-700 transition-colors truncate max-w-xs"
              >
                {suggested}
              </button>
            ))}
          </div>
        </div>

        {/* AI Executive Briefing Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-executive space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">AI Executive Daily Briefing</h2>
                <p className="text-[11px] text-slate-500 font-medium">Real-time data aggregation & context synthesis</p>
              </div>
            </div>

            <button
              onClick={handleRefreshBriefing}
              disabled={isRefreshingBriefing}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBriefing ? 'animate-spin' : ''}`} />
              Refresh Briefing
            </button>
          </div>

          {/* Briefing Content */}
          {briefingData ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {briefingData.summaryText}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Top Priorities Sub-Card */}
                {briefingData.topPriorities && briefingData.topPriorities.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Priorities Today</span>
                    <div className="space-y-1.5">
                      {briefingData.topPriorities.slice(0, 3).map((tp: any) => (
                        <div key={tp.id} className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">• {tp.title}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${getPriorityStyle(tp.priority)}`}>
                            {tp.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Today's Schedule Sub-Card */}
                {briefingData.todaySchedule && briefingData.todaySchedule.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Schedule</span>
                    <div className="space-y-1.5">
                      {briefingData.todaySchedule.slice(0, 3).map((ts: any) => (
                        <div key={ts.id} className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">• {ts.title}</span>
                          <span className="text-[10px] font-medium text-slate-500 shrink-0">{ts.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Factual AI Recommendation Box */}
              <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-lg flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-blue-900 uppercase tracking-wider text-[10px] block">AI Executive Recommendation</span>
                  <p className="text-slate-800 font-medium">{briefingData.recommendation}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">Loading daily AI briefing...</p>
          )}
        </div>

        {/* Overdue Alert Banner if any */}
        {overdueTasks.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-900">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Overdue Task Alert</p>
                <p className="text-sm font-medium">
                  You have {overdueTasks.length} task{overdueTasks.length > 1 ? 's' : ''} past deadline: <span className="font-semibold">{overdueTasks[0].title}</span>
                </p>
              </div>
            </div>
            <Link 
              href="/tasks"
              className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-md transition-colors"
            >
              Resolve Tasks
            </Link>
          </div>
        )}

        {/* Executive 2-Column Grid: Today's Priorities & Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Columns: Today's Priorities */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Today&apos;s Priorities</h2>
                <p className="text-xs text-slate-500">Highest urgency action items</p>
              </div>
              <Link 
                href="/tasks" 
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all ({tasks.filter(t => t.status !== 'Completed').length})
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                Loading executive priorities...
              </div>
            ) : sortedTodayPriorities.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">No high-priority tasks remaining for today.</p>
                <p className="text-xs text-slate-500 mt-1">Your high-level schedule is in good shape.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedTodayPriorities.map((task) => (

                  <div 
                    key={task.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-executive flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPriorityStyle(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {task.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-slate-600 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Today {task.dueTime ? `· ${task.dueTime}` : ''}
                        </span>
                        {task.notes && (
                          <span className="text-slate-400 italic truncate max-w-xs">
                            {task.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming Tasks Section */}
            {upcomingTasks.length > 0 && (
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">Upcoming Tasks ({upcomingTasks.length})</h3>
                  <span className="text-[11px] text-slate-400 font-medium">Scheduled for future dates</span>
                </div>
                <div className="space-y-2">
                  {upcomingTasks.map(task => (
                    <div key={task.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${getPriorityStyle(task.priority)}`}>
                            {task.priority}
                          </span>
                          <p className="font-semibold text-slate-900">{task.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Due {task.dueDate} · {task.dueTime || '10:00 AM'}</p>
                      </div>
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        className="text-xs bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 px-2.5 py-1 rounded transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>


          {/* Right Column: Today's Executive Schedule */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Today&apos;s Schedule</h2>
                <p className="text-xs text-slate-500">Meetings & Deadlines</p>
              </div>
              <Link href="/calendar" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Calendar
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-4">
              <div className="space-y-3">
                {scheduleEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No agenda events for today.</p>
                ) : (
                  scheduleEvents.slice(0, 5).map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-3 bg-slate-50 rounded-lg border-l-4 ${item.type === 'event' ? 'border-l-blue-600' : 'border-l-amber-500'} flex items-start justify-between gap-3`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{item.time}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${item.type === 'event' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {item.type === 'event' ? 'Event' : 'Deadline'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">{item.title}</p>
                        <span className="text-[10px] text-slate-500 font-medium">{item.category}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Total {scheduleEvents.length} agenda items</span>
                <Link href="/calendar" className="font-semibold text-blue-600 hover:underline">
                  Full Schedule →
                </Link>
              </div>
            </div>

            {/* Email Drafts Widget */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Email Drafts ({emailDraftsCount})</h3>
                </div>
                <Link href="/email" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Open Email Assistant →
                </Link>
              </div>

              {mostRecentDraft ? (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[180px]">
                      To: {mostRecentDraft.recipient || '(No Recipient Specified)'}
                    </span>
                    <span className={`
                      text-[10px] font-bold px-2 py-0.5 rounded
                      ${mostRecentDraft.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${mostRecentDraft.status === 'Draft' ? 'bg-amber-100 text-amber-800' : ''}
                      ${mostRecentDraft.status === 'Cancelled' ? 'bg-slate-100 text-slate-600' : ''}
                    `}>
                      {mostRecentDraft.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {mostRecentDraft.subject || '(No Subject)'}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {mostRecentDraft.body}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2 text-center">No active drafts found.</p>
              )}
            </div>

            {/* Compact Executive Upcoming Reminders Widget */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Upcoming Reminders ({dashboardReminders.length})</h3>
                </div>
                <Link href="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                  View All →
                </Link>
              </div>

              {dashboardReminders.length > 0 ? (
                <div className="space-y-2">
                  {dashboardReminders.slice(0, 3).map((rem: any) => {
                    const rDate = new Date(rem.reminderTime);
                    return (
                      <div key={rem.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">• {rem.title}</p>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {mounted ? `${formatDate(rDate, { month: 'short', day: 'numeric' })} at ${formatTime(rDate)}` : '--:--'}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded shrink-0">
                          Scheduled
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2 text-center">No upcoming reminders set.</p>
              )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
}
