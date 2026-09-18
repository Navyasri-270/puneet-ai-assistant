'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Sparkles, 
  CheckSquare, 
  Calendar, 
  Mail, 
  FileText,
  Settings, 
  UserCircle2,
  Briefcase
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Assistant', href: '/assistant', icon: Sparkles, badge: 'AI' },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Notepad', href: '/notepad', icon: FileText },
    { name: 'Email Drafts', href: '/email', icon: Mail },
    { name: 'Settings & Memory', href: '/settings', icon: Settings },
  ];

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 transition-transform duration-200 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      md:static md:translate-x-0
    `}>
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-semibold shadow-sm">
              P
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm tracking-wide">Puneet AI</h1>
              <p className="text-[11px] text-slate-400 font-normal">Executive Assistant</p>
            </div>
          </Link>
          {onClose && (
            <button 
              onClick={onClose}
              className="md:hidden text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Command Center
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-blue-600/90 text-white shadow-sm' 
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-300'}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Executive Profile Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <UserCircle2 className="w-5 h-5 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">Puneet</p>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-slate-500 inline" /> Executive Account
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
