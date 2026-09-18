'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  Calendar, 
  Check, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  Tag, 
  X,
  ChevronDown,
  Bell
} from 'lucide-react';
import { formatDate, formatTime } from '@/lib/dateUtils';
import { useMounted } from '@/lib/useExecutiveTimezone';

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
  outlookEventId?: string;
  outlookSyncStatus?: string;
  outlookSyncError?: string;
}

interface ReminderItem {
  id: string;
  title: string;
  reminderTime: string;
  channel: string;
  triggered: boolean;
  notificationEnabled?: boolean;
  notificationRepeatCount?: number;
  notificationIntervalMinutes?: number;
  notificationSentCount?: number;
  notificationCompleted?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  taskId?: string;
  task?: { id: string; title: string };
  outlookEventId?: string;
  outlookSyncStatus?: string;
  outlookSyncError?: string;
  createdAt: string;
}

function getNotificationTimesPreview(dateStr: string, timeStr: string, repeatCount: number, intervalMins: number): string {
  if (repeatCount <= 0 || intervalMins <= 0) return "";

  const [year, month, day] = (dateStr || new Date().toISOString().split('T')[0]).split('-').map(Number);
  const baseDate = new Date(year, (month || 1) - 1, day || 1, 9, 0, 0);

  const tMatch = (timeStr || "09:00 AM").match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (tMatch) {
    let hours = parseInt(tMatch[1], 10);
    const mins = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
    const ampm = tMatch[3] ? tMatch[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    baseDate.setHours(hours, mins, 0, 0);
  }

  const times: string[] = [];
  for (let i = 0; i < Math.min(repeatCount, 20); i++) {
    const t = new Date(baseDate.getTime() + i * intervalMins * 60 * 1000);
    times.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }

  if (times.length === 1) {
    return `This reminder will notify you once at ${times[0]}.`;
  }
  if (times.length === 2) {
    return `This reminder will notify you 2 times: ${times[0]} and ${times[1]}.`;
  }
  const allButLast = times.slice(0, -1).join(', ');
  const last = times[times.length - 1];
  return `This reminder will notify you ${repeatCount} times: ${allButLast}, and ${last}.`;
}

export default function TasksPage() {
  const mounted = useMounted();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainView, setMainView] = useState<'tasks' | 'reminders'>('tasks');
  const [syncingBulk, setSyncingBulk] = useState(false);

  // Task filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState("All"); // All, To Do, In Progress, Completed
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Reminder filters
  const [reminderFilter, setReminderFilter] = useState<'all' | 'today' | 'upcoming' | 'triggered'>('all');

  // Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "To Do",
    priority: "Medium",
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: "10:00 AM",
    category: "General",
    notes: ""
  });

  // Reminder Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [reminderForm, setReminderForm] = useState({
    title: "",
    reminderDate: new Date().toISOString().split('T')[0],
    reminderTimeStr: "10:00 AM",
    taskId: "",
    notificationEnabled: true,
    notificationRepeatCount: 3,
    notificationIntervalMinutes: 30,
    channel: "Mobile Push",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    timezone: "Asia/Kolkata"
  });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch(`/api/reminders?filter=${reminderFilter}`);
      const data = await res.json();
      if (data.reminders) {
        setReminders(data.reminders);
      }
    } catch (err) {
      console.error("Failed to load reminders:", err);
    }
  }, [reminderFilter]);

  useEffect(() => {
    Promise.allSettled([fetchTasks(), fetchReminders()]);
  }, [fetchTasks, fetchReminders]);

  const handleBulkSync = async () => {
    setSyncingBulk(true);
    try {
      const res = await fetch('/api/outlook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk' })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Outlook Bulk Sync Complete!\nSynced items: ${data.totalSynced}\nFailed items: ${data.totalFailed}`);
        fetchTasks();
        fetchReminders();
      } else {
        alert(`Bulk sync error: ${data.error || 'Failed to complete bulk sync'}`);
      }
    } catch (err: any) {
      alert(`Bulk sync failed: ${err.message}`);
    } finally {
      setSyncingBulk(false);
    }
  };

  const handleManualItemSync = async (type: 'task' | 'reminder', id: string) => {
    try {
      const res = await fetch('/api/outlook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id })
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
        fetchReminders();
      } else {
        alert(`Outlook sync failed: ${data.error || 'Unknown error'}`);
        fetchTasks();
        fetchReminders();
      }
    } catch (err: any) {
      alert(`Sync request failed: ${err.message}`);
    }
  };

  const handleOpenReminderModal = (rem?: ReminderItem) => {
    if (rem) {
      setEditingReminder(rem);
      const dt = new Date(rem.reminderTime);
      const dateStr = dt.toISOString().split('T')[0];
      const timeStr = formatTime(dt);
      setReminderForm({
        title: rem.title,
        reminderDate: dateStr,
        reminderTimeStr: timeStr,
        taskId: rem.taskId || "",
        notificationEnabled: rem.notificationEnabled ?? true,
        notificationRepeatCount: rem.notificationRepeatCount ?? 1,
        notificationIntervalMinutes: rem.notificationIntervalMinutes ?? 15,
        channel: rem.channel || "Mobile Push",
        quietHoursEnabled: rem.quietHoursEnabled ?? false,
        quietHoursStart: rem.quietHoursStart || "22:00",
        quietHoursEnd: rem.quietHoursEnd || "07:00",
        timezone: rem.timezone || "Asia/Kolkata"
      });
    } else {
      setEditingReminder(null);
      setReminderForm({
        title: "",
        reminderDate: new Date().toISOString().split('T')[0],
        reminderTimeStr: "10:00 AM",
        taskId: "",
        notificationEnabled: true,
        notificationRepeatCount: 3,
        notificationIntervalMinutes: 30,
        channel: "Mobile Push",
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        timezone: "Asia/Kolkata"
      });
    }
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderForm.title.trim()) return;

    try {
      const [year, month, day] = reminderForm.reminderDate.split('-').map(Number);
      const targetTime = new Date(year, month - 1, day, 10, 0, 0);

      const tMatch = reminderForm.reminderTimeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
      if (tMatch) {
        let hours = parseInt(tMatch[1], 10);
        const mins = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
        const ampm = tMatch[3] ? tMatch[3].toUpperCase() : null;
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        targetTime.setHours(hours, mins, 0, 0);
      }

      const isoTime = targetTime.toISOString();

      const payload = {
        title: reminderForm.title,
        reminderTime: isoTime,
        taskId: reminderForm.taskId || null,
        channel: reminderForm.channel,
        notificationEnabled: reminderForm.notificationEnabled,
        notificationRepeatCount: Number(reminderForm.notificationRepeatCount),
        notificationIntervalMinutes: Number(reminderForm.notificationIntervalMinutes),
        quietHoursEnabled: reminderForm.quietHoursEnabled,
        quietHoursStart: reminderForm.quietHoursStart,
        quietHoursEnd: reminderForm.quietHoursEnd,
        timezone: reminderForm.timezone
      };

      if (editingReminder) {
        const res = await fetch(`/api/reminders/${editingReminder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.reminder || data.success) {
          setMainView('reminders');
          setReminderFilter('all');
          fetchReminders();
        }
      } else {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.reminder || data.success) {
          setMainView('reminders');
          setReminderFilter('all');
          fetchReminders();
        }
      }
      setIsReminderModalOpen(false);
    } catch (err) {
      console.error("Error saving reminder:", err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    try {
      await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error("Error deleting reminder:", err);
    }
  };

  const handleOpenModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate || new Date().toISOString().split('T')[0],
        dueTime: task.dueTime || "10:00 AM",
        category: task.category || "General",
        notes: task.notes || ""
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: "",
        description: "",
        status: "To Do",
        priority: "Medium",
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: "10:00 AM",
        category: "General",
        notes: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (editingTask) {
        // PUT update
        const res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTask.id, ...formData })
        });
        const data = await res.json();
        if (data.task) {
          setTasks(prev => prev.map(t => t.id === editingTask.id ? data.task : t));
        }
      } else {
        // POST create
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.task) {
          setTasks(prev => [data.task, ...prev]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving task:", err);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'Completed' ? 'To Do' : 'Completed';
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: nextStatus })
      });
      const data = await res.json();
      if (data.task) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
      }
    } catch (err) {
      console.error("Status toggle error:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusTab === 'All' ? true : t.status === statusTab;
    const matchesPriority = priorityFilter === 'All' ? true : t.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'All' ? true : t.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const getPriorityBadge = (priority: string) => {
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
      <div className="space-y-6">
        
        {/* Page Header & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => setMainView('tasks')}
                className={`text-lg font-bold tracking-tight flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                  mainView === 'tasks' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-5 h-5 text-blue-600" />
                Executive Tasks
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setMainView('reminders')}
                className={`text-lg font-bold tracking-tight flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                  mainView === 'reminders' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Bell className="w-5 h-5 text-indigo-600" />
                Reminders ({reminders.length})
              </button>
            </div>
            <p className="text-xs text-slate-500 ml-3">
              {mainView === 'tasks' 
                ? 'Organize, filter, and track all executive action items and deadlines'
                : 'Manage in-app timed executive alerts and scheduled notifications'
              }
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBulkSync}
              disabled={syncingBulk}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Sync all unsynced tasks and reminders to Outlook Calendar"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>{syncingBulk ? 'Syncing...' : 'Sync All to Outlook'}</span>
            </button>
            {mainView === 'tasks' ? (
              <button
                onClick={() => handleOpenModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Executive Task</span>
              </button>
            ) : (
              <button
                onClick={() => handleOpenReminderModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Reminder</span>
              </button>
            )}
          </div>
        </div>

        {/* MAIN VIEW CONTENT */}
        {mainView === 'tasks' ? (
          <>
            {/* Toolbar: Search & Tabs */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg w-full md:w-auto text-xs font-medium text-slate-600">
                  {['All', 'To Do', 'In Progress', 'Completed'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setStatusTab(tab)}
                      className={`
                        px-3.5 py-1.5 rounded-md transition-all flex-1 md:flex-initial text-center
                        ${statusTab === tab 
                          ? 'bg-white text-slate-900 font-semibold shadow-sm' 
                          : 'hover:text-slate-900'
                        }
                      `}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search tasks or categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Secondary Filters */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filters:
                </span>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 font-medium focus:outline-none"
                >
                  <option value="All">All Priorities</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 font-medium focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Clients">Clients</option>
                  <option value="Executive">Executive</option>
                  <option value="Strategy">Strategy</option>
                  <option value="Operations">Operations</option>
                  <option value="General">General</option>
                </select>

                <span className="ml-auto text-slate-400 font-medium">
                  Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Task Cards List */}
            {loading ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                Loading task records...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
                <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-800">No matching tasks found</h3>
                <p className="text-xs text-slate-500">Your task list is clear or try resetting your filter criteria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div 
                    key={task.id}
                    className={`
                      bg-white p-5 rounded-xl border transition-all shadow-executive flex flex-col sm:flex-row sm:items-center justify-between gap-4
                      ${task.status === 'Completed' ? 'border-slate-200 bg-slate-50/50 opacity-75' : 'border-slate-200 hover:border-slate-300'}
                    `}
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                          {task.category}
                        </span>
                        <span className={`text-[11px] font-semibold ${task.status === 'Completed' ? 'text-emerald-600' : 'text-slate-500'}`}>
                          • {task.status}
                        </span>
                        {task.outlookSyncStatus === 'Synced' ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1" title="Synced to Outlook Calendar">
                            <Check className="w-3 h-3 text-emerald-600" /> Synced to Outlook
                          </span>
                        ) : task.outlookSyncStatus === 'Failed' ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1" title={task.outlookSyncError || 'Sync failed'}>
                              <AlertCircle className="w-3 h-3 text-rose-600" /> Sync failed
                            </span>
                            <button
                              onClick={() => handleManualItemSync('task', task.id)}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              Sync to Outlook
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" /> Sync pending
                            </span>
                            <button
                              onClick={() => handleManualItemSync('task', task.id)}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              Sync to Outlook
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className={`text-base font-semibold ${task.status === 'Completed' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Due {task.dueDate} {task.dueTime ? `· ${task.dueTime}` : ''}
                          </span>
                        )}
                        {task.notes && (
                          <span className="text-slate-400 italic">
                            Note: {task.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                      <button
                        onClick={() => handleToggleStatus(task)}
                        className={`
                          text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors
                          ${task.status === 'Completed'
                            ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }
                        `}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {task.status === 'Completed' ? 'Reopen' : 'Complete'}
                      </button>

                      <button
                        onClick={() => handleOpenModal(task)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        title="Edit Task"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* REMINDERS VIEW */
          <div className="space-y-4">
            {/* Filter Pills */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Reminders:
              </span>
              {(['all', 'today', 'upcoming', 'triggered'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setReminderFilter(filter)}
                  className={`
                    text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-colors
                    ${reminderFilter === filter 
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }
                  `}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Reminders List */}
            {reminders.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
                <Bell className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-800">No reminders found</h3>
                <p className="text-xs text-slate-500">Ask the AI Assistant "Remind me in 2 hours..." or click "+ New Reminder".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reminders.map((rem) => {
                  const remDateObj = new Date(rem.reminderTime);
                  const isPast = remDateObj < new Date();
                  return (
                    <div 
                      key={rem.id}
                      className="bg-white p-5 rounded-xl border border-slate-200 shadow-executive flex items-start justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            rem.triggered 
                              ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                              : isPast 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}>
                            {rem.triggered ? 'Triggered / Sent' : isPast ? 'Due Now' : 'Scheduled'}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            Channel: {rem.channel || 'IN_APP'}
                          </span>
                          {rem.outlookSyncStatus === 'Synced' ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1" title="Synced to Outlook Calendar">
                              <Check className="w-3 h-3 text-emerald-600" /> Synced to Outlook
                            </span>
                          ) : rem.outlookSyncStatus === 'Failed' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1" title={rem.outlookSyncError || 'Sync failed'}>
                                <AlertCircle className="w-3 h-3 text-rose-600" /> Sync failed
                              </span>
                              <button
                                onClick={() => handleManualItemSync('reminder', rem.id)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                Sync to Outlook
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" /> Sync pending
                              </span>
                              <button
                                onClick={() => handleManualItemSync('reminder', rem.id)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                Sync to Outlook
                              </button>
                            </div>
                          )}
                        </div>

                        <h4 className="font-semibold text-sm text-slate-900">{rem.title}</h4>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-medium text-slate-700">
                            {mounted ? `${formatDate(remDateObj, { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTime(remDateObj)}` : '--:--'}
                          </span>
                        </div>

                        {rem.task && (
                          <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                            Linked Task: <span className="font-semibold text-slate-700">{rem.task.title}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenReminderModal(rem)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit Reminder"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReminder(rem.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Delete Reminder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Task Editor Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-modal max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">
                  {editingTask ? 'Edit Executive Task' : 'Create Executive Task'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Follow up with Dubai leads"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Key objectives, SLA requirements or details..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    >
                      <option value="Clients">Clients</option>
                      <option value="Executive">Executive</option>
                      <option value="Strategy">Strategy</option>
                      <option value="Operations">Operations</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Due Time</label>
                    <input
                      type="text"
                      value={formData.dueTime}
                      onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                      placeholder="10:00 AM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Notes / Context</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional context or preferences..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                  >
                    {editingTask ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reminder Modal */}
        {isReminderModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-modal max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  {editingReminder ? 'Edit Executive Reminder' : 'Set Executive Reminder'}
                </h2>
                <button 
                  onClick={() => setIsReminderModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveReminder} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Reminder Title *</label>
                  <input
                    type="text"
                    required
                    value={reminderForm.title}
                    onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                    placeholder="e.g. Call John regarding proposal"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Reminder Date *</label>
                    <input
                      type="date"
                      required
                      value={reminderForm.reminderDate}
                      onChange={(e) => setReminderForm({ ...reminderForm, reminderDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Reminder Time *</label>
                    <input
                      type="text"
                      required
                      value={reminderForm.reminderTimeStr}
                      onChange={(e) => setReminderForm({ ...reminderForm, reminderTimeStr: e.target.value })}
                      placeholder="10:00 AM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Repeat Notifications *</label>
                    <select
                      value={reminderForm.notificationRepeatCount}
                      onChange={(e) => setReminderForm({ ...reminderForm, notificationRepeatCount: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs font-medium"
                    >
                      <option value={1}>1 time (Once)</option>
                      <option value={2}>2 times</option>
                      <option value={3}>3 times</option>
                      <option value={4}>4 times</option>
                      <option value={5}>5 times</option>
                      <option value={10}>10 times</option>
                      <option value={15}>15 times</option>
                      <option value={20}>20 times (Max limit)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Time Gap *</label>
                    <select
                      value={reminderForm.notificationIntervalMinutes}
                      onChange={(e) => setReminderForm({ ...reminderForm, notificationIntervalMinutes: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs font-medium"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={240}>4 hours</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Notification Channel</label>
                  <select
                    value={reminderForm.channel}
                    onChange={(e) => setReminderForm({ ...reminderForm, channel: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs font-medium"
                  >
                    <option value="Mobile Push">Mobile Push Notification</option>
                    <option value="In-App">In-App Banner Only</option>
                  </select>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-700 block text-xs">Options</span>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                    <input
                      type="checkbox"
                      checked={reminderForm.notificationEnabled}
                      onChange={(e) => setReminderForm({ ...reminderForm, notificationEnabled: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Enable mobile push notifications</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                    <input
                      type="checkbox"
                      checked={reminderForm.quietHoursEnabled}
                      onChange={(e) => setReminderForm({ ...reminderForm, quietHoursEnabled: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Respect quiet hours (22:00 – 07:00)</span>
                  </label>
                </div>

                {/* Live Preview Banner */}
                {reminderForm.notificationRepeatCount > 0 && (
                  <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl text-indigo-900 text-xs font-medium space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                      <Bell className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Notification Schedule Preview</span>
                    </div>
                    <p className="text-indigo-800 leading-relaxed">
                      {getNotificationTimesPreview(
                        reminderForm.reminderDate,
                        reminderForm.reminderTimeStr,
                        reminderForm.notificationRepeatCount,
                        reminderForm.notificationIntervalMinutes
                      )}
                    </p>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Associate with Task (Optional)</label>
                  <select
                    value={reminderForm.taskId}
                    onChange={(e) => setReminderForm({ ...reminderForm, taskId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                  >
                    <option value="">-- No Linked Task (Standalone Reminder) --</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.priority})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsReminderModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                  >
                    {editingReminder ? 'Save Reminder' : 'Create Reminder'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
