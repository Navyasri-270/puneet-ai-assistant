import { prisma } from './db';
import { getTasks, getReminders, TaskItem } from './taskStore';
import { syncCalendarEventToOutlook, deleteOutlookEvent } from './outlookService';

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string; // YYYY-MM-DDTHH:MM:SS
  endTime: string;   // YYYY-MM-DDTHH:MM:SS
  isAllDay: boolean;
  category: string;
  createdAt: string;
  outlookEventId?: string | null;
  outlookSyncStatus?: string | null;
  outlookSyncError?: string | null;
  source?: 'local_db' | 'google_calendar' | 'outlook';
}

export interface CombinedScheduleItem {
  id: string;
  title: string;
  type: 'event' | 'task_deadline' | 'reminder';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  endTime?: string;
  location?: string;
  description?: string;
  category: string;
  priority?: string; // For task deadlines
  status?: string;   // For task deadlines
  outlookEventId?: string | null;
  outlookSyncStatus?: string | null;
  outlookSyncError?: string | null;
}

// Memory fallback store for high performance and hot-reload safety
let memoryCalendarEvents: CalendarEventItem[] = [];

/**
 * Format local date cleanly without timezone offsets (YYYY-MM-DD)
 */
export function getLocalDateStr(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date object to local ISO string (YYYY-MM-DDTHH:MM:SS) without UTC shift
 */
export function toLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Fetch calendar events from local SQLite database
 */
export async function getCalendarEvents(): Promise<CalendarEventItem[]> {
  try {
    const dbEvents = await prisma.calendarEvent.findMany({
      orderBy: { startTime: 'asc' }
    });

    if (dbEvents && dbEvents.length > 0) {
      const formatted: CalendarEventItem[] = dbEvents.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startTime: toLocalISOString(e.startTime),
        endTime: toLocalISOString(e.endTime),
        isAllDay: e.isAllDay,
        category: e.category,
        outlookEventId: e.outlookEventId,
        outlookSyncStatus: e.outlookSyncStatus,
        outlookSyncError: e.outlookSyncError,
        createdAt: toLocalISOString(e.createdAt),
        source: 'local_db' as const
      }));
      memoryCalendarEvents = formatted;
      return formatted;
    } else {
      return memoryCalendarEvents;
    }
  } catch (err) {
    console.warn("Using in-memory calendar store fallback:", err);
    return memoryCalendarEvents;
  }
}

/**
 * Get unified schedule combining Calendar Events & Task Deadlines across all dates (or filtered by targetDate)
 */
export async function getUnifiedSchedule(targetDate?: string, externalEvents?: CalendarEventItem[]): Promise<CombinedScheduleItem[]> {
  const events = externalEvents || await getCalendarEvents();
  const tasks = await getTasks();

  const combined: CombinedScheduleItem[] = [];

  // Add Calendar Events
  events.forEach(evt => {
    const evtDate = evt.startTime.split('T')[0];
    const timePart = evt.startTime.split('T')[1] || "10:00:00";
    const hours = parseInt(timePart.substring(0, 2), 10);
    const mins = timePart.substring(3, 5);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const timeStr = `${String(formattedHours).padStart(2, '0')}:${mins} ${ampm}`;

    let endStr = "";
    if (evt.endTime) {
      const endPart = evt.endTime.split('T')[1] || "10:30:00";
      const endH = parseInt(endPart.substring(0, 2), 10);
      const endM = endPart.substring(3, 5);
      const endAmpm = endH >= 12 ? 'PM' : 'AM';
      const endFmtH = endH % 12 || 12;
      endStr = `${String(endFmtH).padStart(2, '0')}:${endM} ${endAmpm}`;
    }

    combined.push({
      id: evt.id,
      title: evt.title,
      type: 'event',
      date: evtDate,
      time: timeStr,
      endTime: endStr,
      location: evt.location || undefined,
      description: evt.description || undefined,
      category: evt.category || 'Meeting'
    });
  });

  // Add Task Deadlines
  tasks.filter(t => t.dueDate).forEach(t => {
    combined.push({
      id: `task-deadline-${t.id}`,
      title: t.title,
      type: 'task_deadline',
      date: t.dueDate!,
      time: t.dueTime || '09:00 AM',
      description: t.description || undefined,
      category: t.category || 'Task',
      priority: t.priority,
      status: t.status
    });
  });

  // Add Reminders
  try {
    const reminders = await getReminders('all');
    reminders.forEach(r => {
      const rDateObj = new Date(r.reminderTime);
      const year = rDateObj.getFullYear();
      const month = String(rDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(rDateObj.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const hours = rDateObj.getHours();
      const mins = String(rDateObj.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const fmtH = hours % 12 || 12;
      const timeStr = `${String(fmtH).padStart(2, '0')}:${mins} ${ampm}`;

      combined.push({
        id: `reminder-${r.id}`,
        title: r.title,
        type: 'reminder',
        date: dateStr,
        time: timeStr,
        description: r.task ? `Linked Task: ${r.task.title}` : undefined,
        category: 'Reminder',
        status: r.triggered ? 'Triggered' : 'Scheduled'
      });
    });
  } catch (e) {
    console.warn("Reminders schedule fetch warning:", e);
  }

  // Sort by date then by time
  combined.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  if (targetDate) {
    return combined.filter(item => item.date === targetDate);
  }

  return combined;
}

/**
 * Create a new Calendar Event in SQLite Database & memory store
 */
export async function createCalendarEvent(data: {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM AM/PM or HH:MM
  endTime?: string;
  location?: string;
  description?: string;
  category?: string;
}): Promise<CalendarEventItem> {
  const formattedStartTime = formatDateTimeISO(data.date, data.startTime);
  const formattedEndTime = formatDateTimeISO(
    data.date, 
    data.endTime || calculateDefaultEndTime(data.startTime)
  );

  const newEvent: CalendarEventItem = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: data.title,
    description: data.description || "",
    location: data.location || "",
    startTime: formattedStartTime,
    endTime: formattedEndTime,
    isAllDay: false,
    category: data.category || "Meeting",
    createdAt: toLocalISOString(new Date()),
    source: 'local_db'
  };

  try {
    const startDateObj = parseISOToLocalDate(formattedStartTime);
    const endDateObj = parseISOToLocalDate(formattedEndTime);

    const created = await prisma.calendarEvent.create({
      data: {
        id: newEvent.id,
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        startTime: startDateObj,
        endTime: endDateObj,
        isAllDay: newEvent.isAllDay,
        category: newEvent.category
      }
    });

    try {
      await syncCalendarEventToOutlook(created.id);
    } catch (syncErr) {
      console.warn("Outlook auto-sync error during calendar event creation:", syncErr);
    }

    const latest = await prisma.calendarEvent.findUnique({ where: { id: created.id } });
    const target = latest || created;

    const formatted: CalendarEventItem = {
      id: target.id,
      title: target.title,
      description: target.description,
      location: target.location,
      startTime: toLocalISOString(target.startTime),
      endTime: toLocalISOString(target.endTime),
      isAllDay: target.isAllDay,
      category: target.category,
      outlookEventId: target.outlookEventId,
      outlookSyncStatus: target.outlookSyncStatus,
      outlookSyncError: target.outlookSyncError,
      createdAt: toLocalISOString(target.createdAt),
      source: 'local_db'
    };

    memoryCalendarEvents.push(formatted);
    return formatted;
  } catch (err) {
    console.warn("Prisma Calendar insert warning, saved to memory store:", err);
    memoryCalendarEvents.push(newEvent);
    return newEvent;
  }
}

/**
 * Update an existing Calendar Event
 */
export async function updateCalendarEvent(id: string, updates: Partial<{
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  category: string;
}>): Promise<CalendarEventItem | null> {
  const existingIdx = memoryCalendarEvents.findIndex(e => e.id === id);
  if (existingIdx !== -1) {
    const current = memoryCalendarEvents[existingIdx];
    const targetDate = updates.date || current.startTime.split('T')[0];
    const startISO = updates.startTime ? formatDateTimeISO(targetDate, updates.startTime) : current.startTime;
    const endISO = updates.endTime ? formatDateTimeISO(targetDate, updates.endTime) : current.endTime;

    const updatedItem: CalendarEventItem = {
      ...current,
      title: updates.title || current.title,
      description: updates.description !== undefined ? updates.description : current.description,
      location: updates.location !== undefined ? updates.location : current.location,
      category: updates.category || current.category,
      startTime: startISO,
      endTime: endISO
    };

    memoryCalendarEvents[existingIdx] = updatedItem;

    try {
      await prisma.calendarEvent.update({
        where: { id },
        data: {
          title: updatedItem.title,
          description: updatedItem.description,
          location: updatedItem.location,
          category: updatedItem.category,
          startTime: parseISOToLocalDate(updatedItem.startTime),
          endTime: parseISOToLocalDate(updatedItem.endTime)
        }
      });

      try {
        await syncCalendarEventToOutlook(id);
      } catch (syncErr) {
        console.warn("Outlook auto-sync error during calendar event update:", syncErr);
      }

      const latest = await prisma.calendarEvent.findUnique({ where: { id } });
      if (latest) {
        return {
          id: latest.id,
          title: latest.title,
          description: latest.description,
          location: latest.location,
          startTime: toLocalISOString(latest.startTime),
          endTime: toLocalISOString(latest.endTime),
          isAllDay: latest.isAllDay,
          category: latest.category,
          outlookEventId: latest.outlookEventId,
          outlookSyncStatus: latest.outlookSyncStatus,
          outlookSyncError: latest.outlookSyncError,
          createdAt: toLocalISOString(latest.createdAt),
          source: 'local_db'
        };
      }
    } catch (e) {
      console.warn("DB update warning:", e);
    }

    return updatedItem;
  }
  return null;
}

/**
 * Delete a Calendar Event
 */
export async function deleteCalendarEvent(id: string): Promise<boolean> {
  memoryCalendarEvents = memoryCalendarEvents.filter(e => e.id !== id);
  try {
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (existing?.outlookEventId) {
      try {
        await deleteOutlookEvent(existing.outlookEventId);
      } catch (e) {
        console.warn("Outlook event deletion error:", e);
      }
    }
    await prisma.calendarEvent.delete({ where: { id } });
    return true;
  } catch (err) {
    return true;
  }
}



function formatDateTimeISO(dateStr: string, timeStr: string): string {
  let [hours, minutes] = [10, 0];
  const timeUpper = timeStr.toUpperCase().trim();
  const match = timeUpper.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/);

  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    hours = h;
    minutes = m;
  }

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  return `${dateStr}T${hStr}:${mStr}:00`;
}

function parseISOToLocalDate(isoStr: string): Date {
  const [datePart, timePart] = isoStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
}

function calculateDefaultEndTime(startTimeStr: string): string {
  const match = startTimeStr.toUpperCase().match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/);
  if (match) {
    let h = parseInt(match[1], 10);
    let m = match[2] ? parseInt(match[2], 10) : 0;
    let ampm = match[3] || 'AM';

    m += 60;
    if (m >= 60) {
      h += Math.floor(m / 60);
      m = m % 60;
      if (h >= 12) {
        if (h > 12) h -= 12;
        ampm = ampm === 'AM' ? 'PM' : 'AM';
      }
    }

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return "04:00 PM";
}
