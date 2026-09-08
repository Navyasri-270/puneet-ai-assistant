import { prisma } from './db';
import { initialDemoCalendarEvents } from './demoData';
import { getTasks, TaskItem } from './taskStore';

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
  source?: 'local_db' | 'google_calendar';
}

export interface CombinedScheduleItem {
  id: string;
  title: string;
  type: 'event' | 'task_deadline';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  endTime?: string;
  location?: string;
  description?: string;
  category: string;
  priority?: string; // For task deadlines
  status?: string;   // For task deadlines
}

// Memory fallback store for high performance and hot-reload safety
let memoryCalendarEvents: CalendarEventItem[] = [...initialDemoCalendarEvents.map(e => ({
  ...e,
  isAllDay: e.isAllDay || false,
  createdAt: new Date().toISOString(),
  source: 'local_db' as const
}))];

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
        createdAt: toLocalISOString(e.createdAt),
        source: 'local_db' as const
      }));
      memoryCalendarEvents = formatted;
      return formatted;
    } else {
      await seedInitialCalendar();
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

  // Add Incomplete Task Deadlines
  tasks.filter(t => t.status !== 'Completed' && t.dueDate).forEach(t => {
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

    const formatted: CalendarEventItem = {
      id: created.id,
      title: created.title,
      description: created.description,
      location: created.location,
      startTime: toLocalISOString(created.startTime),
      endTime: toLocalISOString(created.endTime),
      isAllDay: created.isAllDay,
      category: created.category,
      createdAt: toLocalISOString(created.createdAt),
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
    await prisma.calendarEvent.delete({ where: { id } });
    return true;
  } catch (err) {
    return true;
  }
}

/**
 * Seed initial demo events if SQLite database is empty
 */
async function seedInitialCalendar() {
  try {
    for (const evt of initialDemoCalendarEvents) {
      const startObj = parseISOToLocalDate(evt.startTime);
      const endObj = parseISOToLocalDate(evt.endTime);
      await prisma.calendarEvent.upsert({
        where: { id: evt.id },
        update: {},
        create: {
          id: evt.id,
          title: evt.title,
          description: evt.description,
          location: evt.location,
          startTime: startObj,
          endTime: endObj,
          isAllDay: evt.isAllDay || false,
          category: evt.category
        }
      });
    }
  } catch (e) {
    console.warn("Skipping DB seed for calendar:", e);
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
