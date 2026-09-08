'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Sparkles, Bell, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  pendingCount?: number;
}

export default function Header({ onToggleSidebar, pendingCount = 0 }: HeaderProps) {
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-executive">
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Executive Workspace</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 inline" /> Protected & Ready
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            {currentDateFormatted}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Assistant Access */}
        <Link
          href="/assistant"
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Ask Assistant</span>
        </Link>

        {/* Notifications / Pending items pill */}
        <div className="relative">
          <Link 
            href="/tasks"
            className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors relative"
            title="Active Tasks"
          >
            <Bell className="w-4 h-4 text-slate-600" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
