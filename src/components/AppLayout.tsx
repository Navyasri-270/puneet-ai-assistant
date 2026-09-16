'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Bell, X, Clock, CheckCircle } from 'lucide-react';
import { formatTime } from '@/lib/dateUtils';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface DueReminder {
  id: string;
  title: string;
  reminderTime: string;
  channel: string;
  task?: { id: string; title: string };
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(3);
  const [activeToasts, setActiveToasts] = useState<DueReminder[]>([]);

  useEffect(() => {
    // Fetch pending count from API
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        if (data.tasks) {
          const pending = data.tasks.filter((t: any) => t.status !== 'Completed').length;
          setPendingCount(pending);
        }
      })
      .catch(err => console.warn("Task count error:", err));

    // Poll for due reminders every 15 seconds
    const pollReminders = async () => {
      try {
        const res = await fetch('/api/reminders/due');
        const data = await res.json();
        if (data.dueReminders && data.dueReminders.length > 0) {
          setActiveToasts(prev => [...prev, ...data.dueReminders]);
        }
      } catch (err) {
        console.warn("Reminder polling error:", err);
      }
    };

    pollReminders();
    const interval = setInterval(pollReminders, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row text-slate-900 font-sans relative">
      {/* Floating In-App Toast Banners for Due Reminders */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full px-4 pointer-events-none">
        {activeToasts.map(toast => {
          const formattedTime = formatTime(toast.reminderTime);
          return (
            <div 
              key={toast.id}
              className="pointer-events-auto bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-indigo-500/30 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-5 duration-300"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0 mt-0.5">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Executive Reminder</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formattedTime}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-100 mt-1 text-sm">{toast.title}</h4>
                  {toast.task && (
                    <p className="text-xs text-slate-400 mt-0.5">Linked Task: {toast.task.title}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => handleDismissToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Command Center Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
          pendingCount={pendingCount} 
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
