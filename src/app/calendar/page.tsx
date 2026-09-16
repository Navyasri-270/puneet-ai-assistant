'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  CheckSquare, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Info
} from 'lucide-react';
import { CombinedScheduleItem, CalendarEventItem, getLocalDateStr } from '@/lib/calendarService';
import { useMounted, formatDate } from '@/lib/dateUtils';

type CalendarViewMode = 'day' | 'week' | 'month' | 'year' | 'agenda';

export default function CalendarPage() {
  const mounted = useMounted();
  const [view, setView] = useState<CalendarViewMode>('agenda');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<CombinedScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingBulk, setSyncingBulk] = useState(false);

  // External calendar connection states
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isOutlookConnected, setIsOutlookConnected] = useState(false);
  const [outlookDiagnostics, setOutlookDiagnostics] = useState<any>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '03:00 PM',
    endTime: '04:00 PM',
    location: 'Google Meet',
    description: '',
    category: 'Client Meeting'
  });

  const fetchScheduleData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all unified schedule items across all dates
      const res = await fetch('/api/calendar?unified=true');
      if (!res.ok) throw new Error("Failed to load schedule data");
      const data = await res.json();
      if (data.schedule) {
        setSchedule(data.schedule);
      }
      if (typeof data.isGoogleConnected === 'boolean') {
        setIsGoogleConnected(data.isGoogleConnected);
      }
      if (typeof data.isOutlookConnected === 'boolean') {
        setIsOutlookConnected(data.isOutlookConnected);
      }
      if (data.outlookDiagnostics) {
        setOutlookDiagnostics(data.outlookDiagnostics);
      }
    } catch (err: any) {
      console.error("Calendar fetch error:", err);
      setError("We couldn't load your schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, []);

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
        fetchScheduleData();
      } else {
        alert(`Bulk sync error: ${data.error || 'Failed to complete bulk sync'}`);
      }
    } catch (err: any) {
      alert(`Bulk sync failed: ${err.message}`);
    } finally {
      setSyncingBulk(false);
    }
  };

  const handleManualItemSync = async (type: 'task' | 'reminder' | 'event', id: string) => {
    try {
      const res = await fetch('/api/outlook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id })
      });
      const data = await res.json();
      if (data.success) {
        fetchScheduleData();
      } else {
        alert(`Outlook sync failed: ${data.error || 'Unknown error'}`);
        fetchScheduleData();
      }
    } catch (err: any) {
      alert(`Sync request failed: ${err.message}`);
    }
  };

  // Date Navigation Handlers according to view
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrevDate = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else if (view === 'month') next.setMonth(next.getMonth() - 1);
    else if (view === 'year') next.setFullYear(next.getFullYear() - 1);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else if (view === 'month') next.setMonth(next.getMonth() + 1);
    else if (view === 'year') next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  // Open Create/Edit Modal
  const handleOpenCreateModal = (eventToEdit?: CalendarEventItem) => {
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      const startParts = eventToEdit.startTime.split('T');
      const endParts = eventToEdit.endTime ? eventToEdit.endTime.split('T') : ['', '04:00 PM'];
      setFormData({
        title: eventToEdit.title,
        date: startParts[0] || getLocalDateStr(currentDate),
        startTime: startParts[1] ? startParts[1].substring(0, 5) : '03:00 PM',
        endTime: endParts[1] ? endParts[1].substring(0, 5) : '04:00 PM',
        location: eventToEdit.location || '',
        description: eventToEdit.description || '',
        category: eventToEdit.category || 'Meeting'
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        date: getLocalDateStr(currentDate),
        startTime: '03:00 PM',
        endTime: '04:00 PM',
        location: 'Google Meet',
        description: '',
        category: 'Client Meeting'
      });
    }
    setIsCreateModalOpen(true);
  };

  // Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date || !formData.startTime) {
      alert("Please fill in required fields: Title, Date, and Start Time.");
      return;
    }

    try {
      if (editingEvent) {
        const res = await fetch('/api/calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEvent.id, ...formData })
        });
        if (!res.ok) throw new Error("Save event failed");
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error("Create event failed");
      }
      await fetchScheduleData();
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error("Save event error:", err);
      alert("Failed to save calendar event. Please try again.");
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchScheduleData();
      }
    } catch (err) {
      console.error("Delete event error:", err);
    } finally {
      setDeleteConfirmationId(null);
    }
  };

  const currentDateStr = getLocalDateStr(currentDate);

  // Label for Date Title
  const getHeaderDateLabel = () => {
    if (!mounted) return '--';
    if (view === 'day') {
      return formatDate(currentDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7)); // Monday start
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${formatDate(startOfWeek, { month: 'short', day: 'numeric' })} – ${formatDate(endOfWeek, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (view === 'month') {
      return formatDate(currentDate, { month: 'long', year: 'numeric' });
    }
    if (view === 'year') {
      return currentDate.getFullYear().toString();
    }
    return `Schedule Overview (${formatDate(currentDate, { month: 'short', year: 'numeric' })})`;
  };

  // --- MONTH VIEW DATA GENERATION ---
  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday start: 0 for Monday, 6 for Sunday
    const startingDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const days = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        dateStr: getLocalDateStr(prevDate),
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      days.push({
        dateStr: getLocalDateStr(currDate),
        dayNum: d,
        isCurrentMonth: true
      });
    }

    // Next month padding to fill grid to multiple of 7
    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        dateStr: getLocalDateStr(nextDate),
        dayNum: d,
        isCurrentMonth: false
      });
    }

    return days;
  };

  // --- WEEK VIEW DATA GENERATION ---
  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7)); // Monday start

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push({
        dateObj: d,
        dateStr: getLocalDateStr(d),
        dayName: formatDate(d, { weekday: 'short' }),
        dayNum: d.getDate()
      });
    }
    return weekDays;
  };

  // Select day handler
  const handleDaySelect = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, d));
    setView('day');
  };

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.isConnected) setIsGoogleConnected(true);
      })
      .catch(err => console.warn(err));
  }, []);

  return (
    <>
      <div className="space-y-6">
        
        {/* Header Title & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Executive Calendar & Agenda
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-view calendar suite supporting Day, Week, Month, Year, and Agenda
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher: Day | Week | Month | Year | Agenda */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold text-slate-700">
              {(['day', 'week', 'month', 'year', 'agenda'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`
                    px-3 py-1.5 rounded-md capitalize transition-all
                    ${view === v ? 'bg-white text-blue-700 font-bold shadow-sm' : 'hover:text-slate-900'}
                  `}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Bulk Sync Button */}
            <button
              onClick={handleBulkSync}
              disabled={syncingBulk}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-3.5 py-2 rounded-lg border border-slate-300 shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Sync all unsynced tasks, reminders, and events to Outlook Calendar"
            >
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <span>{syncingBulk ? 'Syncing...' : 'Sync All to Outlook'}</span>
            </button>

            {/* Create Event Button */}
            <button
              onClick={() => handleOpenCreateModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Event</span>
            </button>
          </div>
        </div>

        {/* Date Navigation & Status Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleToday}
              className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md transition-colors"
            >
              Today
            </button>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md">
              <button
                onClick={handlePrevDate}
                className="p-1.5 text-slate-600 hover:text-slate-900 border-r border-slate-200"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextDate}
                className="p-1.5 text-slate-600 hover:text-slate-900"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {getHeaderDateLabel()}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <ShieldCheck className={`w-4 h-4 ${isOutlookConnected ? 'text-blue-600' : 'text-slate-400'} shrink-0`} />
              <span>{isOutlookConnected ? 'Outlook 365 Connected' : 'Outlook 365 Disconnected'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <ShieldCheck className={`w-4 h-4 ${isGoogleConnected ? 'text-emerald-600' : 'text-slate-400'} shrink-0`} />
              <span>{isGoogleConnected ? 'Google Calendar Connected' : 'Google Calendar Disconnected'}</span>
            </div>
          </div>

        </div>

        {/* Outlook Empty State / Diagnostic Notice */}
        {isOutlookConnected && (!outlookDiagnostics || outlookDiagnostics.eventsCount === 0) && (
          <div className="bg-blue-50/70 border border-blue-200 text-blue-900 p-3.5 rounded-xl text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-blue-950">No Outlook events found in this date range.</span>
            </div>
            {outlookDiagnostics && (
              <span className="text-[10px] text-blue-800 bg-blue-100 px-2.5 py-1 rounded border border-blue-200 shrink-0 font-mono">
                Graph /me/calendarView · HTTP {outlookDiagnostics.httpStatus} · {outlookDiagnostics.eventsCount} events
              </span>
            )}
          </div>
        )}


        {/* Main Schedule Display depending on View Mode */}
        {loading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
            Loading schedule data...
          </div>
        ) : error ? (
          <div className="p-12 text-center bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="w-6 h-6 text-rose-600 mx-auto mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : (
          <div>
            
            {/* ==================== 1. MONTH VIEW ==================== */}
            {view === 'month' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-executive overflow-hidden">
                {/* Days of week header */}
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-2 text-xs font-bold text-slate-600">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
                  {generateMonthDays().map((cell, idx) => {
                    const dayItems = schedule.filter(item => item.date === cell.dateStr);
                    const isToday = cell.dateStr === getLocalDateStr(new Date());

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDaySelect(cell.dateStr)}
                        className={`
                          min-h-[110px] p-2 transition-all cursor-pointer hover:bg-slate-50/80 flex flex-col justify-between
                          ${!cell.isCurrentMonth ? 'bg-slate-50/40 text-slate-400' : 'bg-white text-slate-900'}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`
                            text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center
                            ${isToday ? 'bg-blue-600 text-white' : ''}
                          `}>
                            {cell.dayNum}
                          </span>
                          {dayItems.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-400">
                              {dayItems.length} {dayItems.length === 1 ? 'item' : 'items'}
                            </span>
                          )}
                        </div>

                        {/* Events list preview */}
                        <div className="space-y-1 my-1">
                          {dayItems.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className={`
                                text-[10px] p-1 rounded font-medium truncate flex items-center gap-1
                                ${item.type === 'event' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}
                              `}
                            >
                              <span className="font-bold shrink-0">{item.time}</span>
                              <span className="truncate">{item.title}</span>
                            </div>
                          ))}
                          {dayItems.length > 3 && (
                            <p className="text-[9px] text-slate-500 font-semibold pl-1">
                              +{dayItems.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== 2. WEEK VIEW ==================== */}
            {view === 'week' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-executive overflow-hidden">
                <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[500px]">
                  {generateWeekDays().map((day) => {
                    const dayItems = schedule.filter(item => item.date === day.dateStr);
                    const isToday = day.dateStr === getLocalDateStr(new Date());

                    return (
                      <div key={day.dateStr} className="flex flex-col">
                        {/* Day Header */}
                        <div className={`p-3 text-center border-b border-slate-200 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                          <p className="text-xs font-semibold text-slate-500 uppercase">{day.dayName}</p>
                          <p className={`text-base font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>{day.dayNum}</p>
                        </div>

                        {/* Events Content */}
                        <div className="p-2 space-y-2 flex-1">
                          {dayItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 text-center py-6">No events</p>
                          ) : (
                            dayItems.map((item) => (
                              <div
                                key={item.id}
                                className={`
                                  p-2 rounded-lg border text-xs space-y-1
                                  ${item.type === 'event' ? 'bg-white border-blue-200 border-l-4 border-l-blue-600 shadow-sm' : 'bg-amber-50/50 border-amber-200 border-l-4 border-l-amber-500'}
                                `}
                              >
                                <p className="text-[10px] font-bold text-slate-500">{item.time}</p>
                                <p className="font-semibold text-slate-900 line-clamp-2">{item.title}</p>
                                {item.location && <p className="text-[10px] text-slate-400 truncate">{item.location}</p>}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== 3. DAY VIEW ==================== */}
            {view === 'day' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-executive space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Schedule for {mounted ? formatDate(currentDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '--'}
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    {schedule.filter(item => item.date === currentDateStr).length} items scheduled
                  </span>
                </div>

                {schedule.filter(item => item.date === currentDateStr).length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">No events scheduled for this date.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedule.filter(item => item.date === currentDateStr).map((item) => (
                      <div
                        key={item.id}
                        className={`
                          p-4 rounded-xl border flex items-start justify-between gap-4 shadow-sm
                          ${item.type === 'event' 
                            ? 'bg-white border-blue-200 border-l-4 border-l-blue-600' 
                            : item.type === 'reminder'
                              ? 'bg-indigo-50/50 border-indigo-200 border-l-4 border-l-indigo-600'
                              : 'bg-amber-50/40 border-amber-200 border-l-4 border-l-amber-500'
                          }
                        `}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              item.type === 'event' 
                                ? 'bg-blue-100 text-blue-800' 
                                : item.type === 'reminder'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.type === 'event' ? 'Calendar Event' : item.type === 'reminder' ? 'Executive Reminder' : 'Task Deadline'}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">{item.time} {item.endTime ? `- ${item.endTime}` : ''}</span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                          {item.description && <p className="text-xs text-slate-600">{item.description}</p>}
                          {item.location && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.location}
                            </p>
                          )}
                        </div>

                        {item.type === 'event' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenCreateModal({
                                id: item.id,
                                title: item.title,
                                description: item.description || '',
                                location: item.location || '',
                                startTime: `${item.date}T${item.time}`,
                                endTime: `${item.date}T${item.endTime || item.time}`,
                                isAllDay: false,
                                category: item.category,
                                createdAt: new Date().toISOString()
                              })}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmationId(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ==================== 4. YEAR VIEW ==================== */}
            {view === 'year' && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, mIdx) => {
                  const monthDate = new Date(currentDate.getFullYear(), mIdx, 1);
                  const monthName = formatDate(monthDate, { month: 'long' });
                  
                  // Filter schedule items in this month
                  const monthPrefix = `${currentDate.getFullYear()}-${String(mIdx + 1).padStart(2, '0')}`;
                  const monthItems = schedule.filter(item => item.date.startsWith(monthPrefix));

                  return (
                    <div
                      key={mIdx}
                      onClick={() => {
                        setCurrentDate(monthDate);
                        setView('month');
                      }}
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-executive space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h3 className="font-bold text-sm text-slate-900">{monthName}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${monthItems.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                          {monthItems.length} items
                        </span>
                      </div>

                      {monthItems.length === 0 ? (
                        <p className="text-[11px] text-slate-400 py-4 text-center">No activity scheduled</p>
                      ) : (
                        <div className="space-y-1.5">
                          {monthItems.slice(0, 3).map((item) => (
                            <div key={item.id} className="text-[11px] flex items-center justify-between text-slate-700">
                              <span className="font-semibold truncate max-w-[120px]">{item.title}</span>
                              <span className="text-[10px] text-slate-400">{item.date.substring(8)}th</span>
                            </div>
                          ))}
                          {monthItems.length > 3 && (
                            <p className="text-[10px] font-bold text-blue-600 pt-1">+ {monthItems.length - 3} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ==================== 5. AGENDA VIEW ==================== */}
            {view === 'agenda' && (
              <div className="space-y-4">
                {schedule.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No upcoming events or task deadlines scheduled.
                  </div>
                ) : (
                  schedule.map((item) => (
                    <div 
                      key={item.id}
                      className={`
                        p-5 rounded-xl border transition-all shadow-executive flex flex-col sm:flex-row sm:items-center justify-between gap-4
                        ${item.type === 'event' 
                          ? 'bg-white border-blue-200 border-l-4 border-l-blue-600' 
                          : item.type === 'reminder'
                            ? 'bg-indigo-50/50 border-indigo-200 border-l-4 border-l-indigo-600'
                            : 'bg-amber-50/40 border-amber-200 border-l-4 border-l-amber-500'
                        }
                      `}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.type === 'event' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" /> Calendar Event
                            </span>
                          ) : item.type === 'reminder' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-indigo-600" /> Executive Reminder
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <CheckSquare className="w-3 h-3" /> Task Deadline
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-slate-500">{item.category}</span>
                          {item.outlookSyncStatus === 'Synced' ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1" title="Synced to Outlook Calendar">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Synced to Outlook
                            </span>
                          ) : item.outlookSyncStatus === 'Failed' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1" title={item.outlookSyncError || 'Sync failed'}>
                                <AlertCircle className="w-3 h-3 text-rose-600" /> Sync failed
                              </span>
                              <button
                                onClick={() => handleManualItemSync(item.type === 'event' ? 'event' : item.type === 'reminder' ? 'reminder' : 'task', item.id.replace('task-deadline-', '').replace('reminder-', ''))}
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
                                onClick={() => handleManualItemSync(item.type === 'event' ? 'event' : item.type === 'reminder' ? 'reminder' : 'task', item.id.replace('task-deadline-', '').replace('reminder-', ''))}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                Sync to Outlook
                              </button>
                            </div>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                        {item.description && <p className="text-xs text-slate-600">{item.description}</p>}

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {item.date} · {item.time} {item.endTime ? `- ${item.endTime}` : ''}
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.type === 'event' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenCreateModal({
                              id: item.id,
                              title: item.title,
                              description: item.description || '',
                              location: item.location || '',
                              startTime: `${item.date}T${item.time}`,
                              endTime: `${item.date}T${item.endTime || item.time}`,
                              isAllDay: false,
                              category: item.category,
                              createdAt: new Date().toISOString()
                            })}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmationId(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}

        {/* Create / Edit Calendar Event Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-modal max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">
                  {editingEvent ? 'Edit Calendar Event' : 'Schedule Calendar Event'}
                </h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Event Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Meeting with John"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Start Time *</label>
                    <input
                      type="text"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      placeholder="03:00 PM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">End Time</label>
                    <input
                      type="text"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      placeholder="04:00 PM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Google Meet"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                    >
                      <option value="Client Meeting">Client Meeting</option>
                      <option value="Internal Sync">Internal Sync</option>
                      <option value="Investor Relations">Investor Relations</option>
                      <option value="Executive Review">Executive Review</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Description / Notes</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Agenda items..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                  >
                    {editingEvent ? 'Save Changes' : 'Schedule Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmationId && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-modal max-w-sm w-full p-6 space-y-4 text-center">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete this calendar event?</h3>
                <p className="text-xs text-slate-500 mt-1">This action cannot be undone.</p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmationId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteEvent(deleteConfirmationId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
