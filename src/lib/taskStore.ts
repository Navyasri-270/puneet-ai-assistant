import { prisma } from './db';
import { syncTaskToOutlook, syncReminderToOutlook, deleteOutlookEvent } from './outlookService';
import { getGreetingForTimezone, DEFAULT_TIMEZONE } from './dateUtils';

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string; // "To Do", "In Progress", "Completed"
  priority: string; // "Low", "Medium", "High", "Urgent"
  dueDate?: string | null;
  dueTime?: string | null;
  category: string;
  notes?: string | null;
  outlookEventId?: string | null;
  outlookSyncStatus?: string | null;
  outlookSyncError?: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory fallback cache for empty/fallback states without demo data
let memoryTasks: TaskItem[] = [];
let memoryCalendar: any[] = [];
let memoryEmails: any[] = [];
let memoryStore: any[] = [];

export async function getTasks(): Promise<TaskItem[]> {
  try {
    const dbTasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
    });
    if (dbTasks && dbTasks.length > 0) {
      return dbTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        category: t.category,
        notes: t.notes,
        outlookEventId: t.outlookEventId,
        outlookSyncStatus: t.outlookSyncStatus,
        outlookSyncError: t.outlookSyncError,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
    } else {
      return memoryTasks;
    }
  } catch (err) {
    console.warn("Using in-memory task store fallback:", err);
    return memoryTasks;
  }
}

export async function createTask(data: Partial<TaskItem>): Promise<TaskItem> {
  const newTask: TaskItem = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: data.title || "Untitled Task",
    description: data.description || "",
    status: data.status || "To Do",
    priority: data.priority || "Medium",
    dueDate: data.dueDate || new Date().toISOString().split('T')[0],
    dueTime: data.dueTime || "09:00 AM",
    category: data.category || "General",
    notes: data.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const created = await prisma.task.create({
      data: {
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        dueTime: newTask.dueTime,
        category: newTask.category,
        notes: newTask.notes,
      },
    });

    try {
      const syncResult = await syncTaskToOutlook(created.id);
      if (!syncResult.success) {
        await prisma.task.update({
          where: { id: created.id },
          data: { outlookSyncStatus: 'Failed', outlookSyncError: syncResult.error || 'Sync failed' }
        });
      }
    } catch (syncErr: any) {
      console.warn("Outlook auto-sync error during task creation:", syncErr);
      await prisma.task.update({
        where: { id: created.id },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: syncErr?.message || 'Sync failed' }
      });
    }

    const latest = await prisma.task.findUnique({ where: { id: created.id } });
    const target = latest || created;

    const formatted: TaskItem = {
      ...target,
      description: target.description || "",
      dueDate: target.dueDate || "",
      dueTime: target.dueTime || "",
      notes: target.notes || "",
      outlookEventId: target.outlookEventId,
      outlookSyncStatus: target.outlookSyncStatus,
      outlookSyncError: target.outlookSyncError,
      createdAt: target.createdAt.toISOString(),
      updatedAt: target.updatedAt.toISOString(),
    };
    memoryTasks.unshift(formatted);
    return formatted;
  } catch (err) {
    console.warn("DB insert failed, using in-memory store:", err);
    memoryTasks.unshift(newTask);
    return newTask;
  }
}

export async function updateTask(id: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
  try {
    const existingIndex = memoryTasks.findIndex(t => t.id === id);
    if (existingIndex !== -1) {
      memoryTasks[existingIndex] = {
        ...memoryTasks[existingIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    
    const dataToUpdate: any = {
      ...updates,
      updatedAt: new Date(),
    };
    if (updates.dueDate !== undefined || updates.dueTime !== undefined || (updates.status && updates.status !== 'Completed' && updates.status !== 'Done' && updates.status !== 'Cancelled')) {
      dataToUpdate.notificationSent = false;
      dataToUpdate.beforeNotifiedAt = null;
      dataToUpdate.dueNotifiedAt = null;
      dataToUpdate.overdueNotifiedAt = null;
    }

    const dbUpdated = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
    });

    try {
      await syncTaskToOutlook(id);
    } catch (syncErr) {
      console.warn("Outlook auto-sync error during task update:", syncErr);
    }

    const latest = await prisma.task.findUnique({ where: { id } });
    const finalObj = latest || dbUpdated;

    return {
      ...finalObj,
      description: finalObj.description || "",
      dueDate: finalObj.dueDate || "",
      dueTime: finalObj.dueTime || "",
      notes: finalObj.notes || "",
      outlookEventId: finalObj.outlookEventId,
      outlookSyncStatus: finalObj.outlookSyncStatus,
      outlookSyncError: finalObj.outlookSyncError,
      createdAt: finalObj.createdAt.toISOString(),
      updatedAt: finalObj.updatedAt.toISOString(),
    };
  } catch (err) {
    const task = memoryTasks.find(t => t.id === id);
    return task || null;
  }
}

export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      memoryTasks = memoryTasks.filter(t => t.id !== id);
      return { success: true };
    }

    if (existing.outlookEventId) {
      const delRes = await deleteOutlookEvent(existing.outlookEventId);
      if (!delRes.success) {
        await prisma.task.update({
          where: { id },
          data: {
            outlookSyncStatus: 'Failed',
            outlookSyncError: delRes.error || 'Failed to delete Outlook event'
          }
        }).catch(() => {});
        return { success: false, error: delRes.error || 'Failed to delete Outlook event' };
      }
    }

    memoryTasks = memoryTasks.filter(t => t.id !== id);
    await prisma.task.delete({ where: { id } });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete task' };
  }
}



export async function generateBriefingSummary() {
  const tasks = await getTasks();
  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayTasks = tasks.filter(t => t.dueDate === todayStr && t.status !== 'Completed');
  const highPriorityToday = todayTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'Completed');
  
  let summaryText = `${getGreetingForTimezone(new Date())}, Puneet. You have ${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} scheduled for today`;
  if (highPriorityToday.length > 0) {
    summaryText += `, including ${highPriorityToday.length} high-priority item${highPriorityToday.length > 1 ? 's' : ''}`;
  }
  summaryText += '.';
  
  if (overdueTasks.length > 0) {
    summaryText += ` Note: You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} requiring attention.`;
  }
  
  if (todayTasks.length > 0) {
    const topToday = highPriorityToday[0] || todayTasks[0];
    summaryText += ` Your primary task today is "${topToday.title}".`;
  } else {
    summaryText += ` Your schedule for today is clear of pending tasks.`;
  }

  return {
    todayCount: todayTasks.length,
    highPriorityCount: highPriorityToday.length,
    overdueCount: overdueTasks.length,
    summaryText
  };
}


export async function getCalendarEvents() {
  return memoryCalendar;
}

export async function getMemories() {
  try {
    const dbMems = await prisma.memory.findMany({
      orderBy: { createdAt: 'desc' },
    });
    if (dbMems && dbMems.length > 0) {
      return dbMems.map(m => ({
        id: m.id,
        key: m.key,
        value: m.value,
        category: m.category,
        createdAt: m.createdAt.toISOString(),
        updatedAt: (m as any).updatedAt ? (m as any).updatedAt.toISOString() : m.createdAt.toISOString(),
      }));
    }
  } catch (err) {
    console.warn("DB memories fetch fallback:", err);
  }
  return memoryStore;
}

export async function createMemory(data: { key: string; value: string; category?: string }) {
  const newMem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    key: data.key,
    value: data.value,
    category: data.category || 'Preferences',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const created = await prisma.memory.upsert({
      where: { key: data.key },
      update: {
        value: data.value,
        category: data.category || 'Preferences'
      },
      create: {
        id: newMem.id,
        key: data.key,
        value: data.value,
        category: data.category || 'Preferences'
      }
    });
    const formatted = {
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: (created as any).updatedAt ? (created as any).updatedAt.toISOString() : created.createdAt.toISOString()
    };
    memoryStore = memoryStore.filter(m => m.key !== data.key);
    memoryStore.unshift(formatted);
    return formatted;
  } catch (err) {
    console.warn("DB create memory fallback:", err);
    memoryStore = memoryStore.filter(m => m.key !== data.key);
    memoryStore.unshift(newMem);
    return newMem;
  }
}

export async function updateMemory(id: string, updates: Partial<{ key: string; value: string; category: string }>) {
  try {
    const idx = memoryStore.findIndex(m => m.id === id);
    if (idx !== -1) {
      memoryStore[idx] = { ...memoryStore[idx], ...updates } as any;
    }
    const updated = await prisma.memory.update({
      where: { id },
      data: {
        ...updates
      }
    });
    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: (updated as any).updatedAt ? (updated as any).updatedAt.toISOString() : updated.createdAt.toISOString()
    };
  } catch (err) {
    console.warn("DB update memory fallback:", err);
    return memoryStore.find(m => m.id === id) || null;
  }
}

export async function deleteMemory(id: string) {
  memoryStore = memoryStore.filter(m => m.id !== id);
  try {
    await prisma.memory.delete({ where: { id } });
    return true;
  } catch (err) {
    return true;
  }
}

export async function deleteMemoryByKey(key: string) {
  memoryStore = memoryStore.filter(m => m.key !== key);
  try {
    await prisma.memory.deleteMany({ where: { key: { equals: key } } });
    return true;
  } catch (err) {
    return true;
  }
}

/**
 * Keyword & category-based memory relevance search
 * Retrieves ONLY memories that match the current user request.
 */
export async function getRelevantMemories(prompt: string) {
  const allMemories = await getMemories();
  const lowerPrompt = prompt.toLowerCase();

  // Tokenize prompt into significant words (3+ chars)
  const words = lowerPrompt.split(/\W+/).filter(w => w.length > 2);

  const relevant = allMemories.filter(mem => {
    const keyLower = mem.key.toLowerCase();
    const valLower = mem.value.toLowerCase();
    const catLower = mem.category.toLowerCase();

    // 1. Email / Communication Context
    if (/\b(email|draft|write|message|communication|letter|reply)\b/i.test(lowerPrompt)) {
      if (catLower === 'communication' || keyLower.includes('email') || valLower.includes('email') || valLower.includes('concise')) {
        return true;
      }
    }

    // 2. Scheduling / Meeting Context
    if (/\b(schedule|meeting|call|sync|appointment|calendar|duration)\b/i.test(lowerPrompt)) {
      if (keyLower.includes('meeting') || valLower.includes('meeting') || keyLower.includes('friday') || valLower.includes('friday') || valLower.includes('call')) {
        return true;
      }
    }

    // 3. Entity / Client / Keyword Match
    for (const word of words) {
      if (['the', 'and', 'for', 'with', 'that', 'this', 'from', 'your'].includes(word)) continue;
      if (keyLower.includes(word) || valLower.includes(word) || catLower.includes(word)) {
        return true;
      }
    }

    return false;
  });

  return relevant;
}

export async function getEmailDrafts() {
  try {
    const dbDrafts = await prisma.emailDraft.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    if (dbDrafts && dbDrafts.length > 0) {
      return dbDrafts.map(d => ({
        id: d.id,
        recipient: d.recipient,
        cc: d.cc || '',
        bcc: d.bcc || '',
        subject: d.subject,
        body: d.body,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }));
    }
  } catch (err) {
    console.warn("DB email drafts fetch fallback:", err);
  }
  return memoryEmails;
}

export async function getEmailDraftById(id: string) {
  try {
    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (draft) {
      return {
        ...draft,
        cc: draft.cc || '',
        bcc: draft.bcc || '',
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString()
      };
    }
  } catch (err) {
    console.warn("DB email draft fetch by id fallback:", err);
  }
  return memoryEmails.find(e => e.id === id) || null;
}

export async function createEmailDraft(data: { recipient?: string; subject?: string; body?: string; cc?: string; bcc?: string; status?: string } | string, subjectArg?: string, bodyArg?: string) {
  let recipient = '';
  let subject = '';
  let body = '';
  let cc = '';
  let bcc = '';
  let status = 'Draft';

  if (typeof data === 'string') {
    recipient = data;
    subject = subjectArg || '';
    body = bodyArg || '';
  } else {
    recipient = data.recipient || '';
    subject = data.subject || '';
    body = data.body || '';
    cc = data.cc || '';
    bcc = data.bcc || '';
    status = data.status || 'Draft';
  }

  const newDraft = {
    id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    recipient,
    cc,
    bcc,
    subject,
    body,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const created = await prisma.emailDraft.create({
      data: {
        id: newDraft.id,
        recipient: newDraft.recipient,
        cc: newDraft.cc,
        bcc: newDraft.bcc,
        subject: newDraft.subject,
        body: newDraft.body,
        status: newDraft.status
      }
    });
    const formatted = {
      ...created,
      cc: created.cc || '',
      bcc: created.bcc || '',
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
    memoryEmails.unshift(formatted);
    return formatted;
  } catch (err) {
    console.warn("DB create email draft fallback:", err);
    memoryEmails.unshift(newDraft);
    return newDraft;
  }
}

export async function updateEmailDraft(id: string, updates: Partial<{ recipient: string; subject: string; body: string; cc: string; bcc: string; status: string }>) {
  try {
    const idx = memoryEmails.findIndex(e => e.id === id);
    if (idx !== -1) {
      memoryEmails[idx] = {
        ...memoryEmails[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    const updated = await prisma.emailDraft.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });
    return {
      ...updated,
      cc: updated.cc || '',
      bcc: updated.bcc || '',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  } catch (err) {
    console.warn("DB update email draft fallback:", err);
    const existing = memoryEmails.find(e => e.id === id);
    return existing || null;
  }
}

export async function deleteEmailDraft(id: string) {
  memoryEmails = memoryEmails.filter(e => e.id !== id);
  try {
    await prisma.emailDraft.delete({ where: { id } });
    return true;
  } catch (err) {
    return true;
  }
}

export interface ReminderItem {
  id: string;
  title: string;
  taskId?: string | null;
  task?: TaskItem | null;
  reminderTime: string;
  channel: string;
  triggered: boolean;
  notificationEnabled?: boolean;
  notificationSent?: boolean;
  notificationBefore?: number;
  notificationRepeatCount?: number;
  notificationIntervalMinutes?: number;
  notificationSentCount?: number;
  nextNotificationAt?: string | null;
  lastNotificationAt?: string | null;
  notificationCompleted?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string | null;
  outlookEventId?: string | null;
  outlookSyncStatus?: string | null;
  outlookSyncError?: string | null;
  createdAt: string;
}

let memoryReminders: ReminderItem[] = [];

function mapDbReminderToItem(r: any): ReminderItem {
  return {
    id: r.id,
    title: r.title || 'Executive Reminder',
    taskId: r.taskId,
    task: r.task ? {
      id: r.task.id,
      title: r.task.title,
      description: r.task.description,
      status: r.task.status,
      priority: r.task.priority,
      dueDate: r.task.dueDate,
      dueTime: r.task.dueTime,
      category: r.task.category,
      notes: r.task.notes,
      createdAt: r.task.createdAt.toISOString(),
      updatedAt: r.task.updatedAt.toISOString(),
    } : null,
    reminderTime: r.reminderTime.toISOString(),
    channel: r.channel,
    triggered: r.triggered,
    notificationEnabled: r.notificationEnabled ?? true,
    notificationSent: r.notificationSent ?? false,
    notificationBefore: r.notificationBefore ?? 15,
    notificationRepeatCount: r.notificationRepeatCount ?? 1,
    notificationIntervalMinutes: r.notificationIntervalMinutes ?? 15,
    notificationSentCount: r.notificationSentCount ?? 0,
    nextNotificationAt: r.nextNotificationAt ? r.nextNotificationAt.toISOString() : null,
    lastNotificationAt: r.lastNotificationAt ? r.lastNotificationAt.toISOString() : (r.lastNotifiedAt ? r.lastNotifiedAt.toISOString() : null),
    notificationCompleted: r.notificationCompleted ?? false,
    quietHoursEnabled: r.quietHoursEnabled ?? false,
    quietHoursStart: r.quietHoursStart ?? '22:00',
    quietHoursEnd: r.quietHoursEnd ?? '07:00',
    timezone: r.timezone ?? DEFAULT_TIMEZONE,
    outlookEventId: r.outlookEventId,
    outlookSyncStatus: r.outlookSyncStatus,
    outlookSyncError: r.outlookSyncError,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getReminders(filter?: 'today' | 'upcoming' | 'triggered' | 'all') {
  const todayStr = new Date().toISOString().split('T')[0];
  const nowISO = new Date().toISOString();

  try {
    const dbReminders = await prisma.reminder.findMany({
      include: { task: true },
      orderBy: { reminderTime: 'asc' },
    });

    if (dbReminders && dbReminders.length > 0) {
      let formatted: ReminderItem[] = dbReminders.map(mapDbReminderToItem);

      if (filter === 'today') {
        formatted = formatted.filter(r => r.reminderTime.startsWith(todayStr));
      } else if (filter === 'upcoming') {
        formatted = formatted.filter(r => r.reminderTime >= nowISO && !r.notificationCompleted);
      } else if (filter === 'triggered') {
        formatted = formatted.filter(r => r.triggered || r.notificationCompleted);
      }

      return formatted;
    }
  } catch (err) {
    console.warn("DB reminders fetch fallback:", err);
  }

  let memoryResult = [...memoryReminders];
  if (filter === 'today') {
    memoryResult = memoryResult.filter(r => r.reminderTime.startsWith(todayStr));
  } else if (filter === 'upcoming') {
    memoryResult = memoryResult.filter(r => r.reminderTime >= nowISO && !r.notificationCompleted);
  } else if (filter === 'triggered') {
    memoryResult = memoryResult.filter(r => r.triggered || r.notificationCompleted);
  }
  return memoryResult;
}

export async function createReminder(data: {
  title?: string;
  reminderTime: string | Date;
  taskId?: string;
  channel?: string;
  notificationEnabled?: boolean;
  notificationBefore?: number;
  notificationRepeatCount?: number;
  notificationIntervalMinutes?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}) {
  const rTime = typeof data.reminderTime === 'string' ? new Date(data.reminderTime) : data.reminderTime;
  const repeatCount = Math.max(1, Math.min(20, data.notificationRepeatCount ?? 1));
  const intervalMins = Math.max(5, data.notificationIntervalMinutes ?? 15);
  
  const newReminder: ReminderItem = {
    id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: data.title || 'Executive Reminder',
    taskId: data.taskId || null,
    reminderTime: rTime.toISOString(),
    channel: data.channel || 'In-App',
    triggered: false,
    notificationEnabled: data.notificationEnabled ?? true,
    notificationSent: false,
    notificationBefore: data.notificationBefore ?? 15,
    notificationRepeatCount: repeatCount,
    notificationIntervalMinutes: intervalMins,
    notificationSentCount: 0,
    nextNotificationAt: rTime.toISOString(),
    lastNotificationAt: null,
    notificationCompleted: false,
    quietHoursEnabled: data.quietHoursEnabled ?? false,
    quietHoursStart: data.quietHoursStart ?? '22:00',
    quietHoursEnd: data.quietHoursEnd ?? '07:00',
    timezone: data.timezone ?? DEFAULT_TIMEZONE,
    createdAt: new Date().toISOString()
  };

  try {
    const created = await prisma.reminder.create({
      data: {
        id: newReminder.id,
        title: newReminder.title,
        taskId: newReminder.taskId || undefined,
        reminderTime: rTime,
        channel: newReminder.channel,
        triggered: false,
        notificationEnabled: newReminder.notificationEnabled,
        notificationBefore: newReminder.notificationBefore,
        notificationRepeatCount: repeatCount,
        notificationIntervalMinutes: intervalMins,
        notificationSentCount: 0,
        nextNotificationAt: rTime,
        notificationCompleted: false,
        quietHoursEnabled: newReminder.quietHoursEnabled,
        quietHoursStart: newReminder.quietHoursStart,
        quietHoursEnd: newReminder.quietHoursEnd,
        timezone: newReminder.timezone,
      },
      include: { task: true }
    });

    try {
      const syncResult = await syncReminderToOutlook(created.id);
      if (!syncResult.success) {
        await prisma.reminder.update({
          where: { id: created.id },
          data: { outlookSyncStatus: 'Failed', outlookSyncError: syncResult.error || 'Sync failed' }
        });
      }
    } catch (syncErr: any) {
      console.warn("Outlook auto-sync error during reminder creation:", syncErr);
      await prisma.reminder.update({
        where: { id: created.id },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: syncErr?.message || 'Sync failed' }
      });
    }

    const latest = await prisma.reminder.findUnique({ where: { id: created.id }, include: { task: true } });
    const target = latest || created;

    const formatted: ReminderItem = mapDbReminderToItem(target);
    memoryReminders.unshift(formatted);
    return formatted;
  } catch (err) {
    console.warn("DB create reminder fallback:", err);
    memoryReminders.unshift(newReminder);
    return newReminder;
  }
}

export async function updateReminder(
  id: string,
  updates: Partial<{
    title: string;
    reminderTime: string | Date;
    taskId: string;
    triggered: boolean;
    channel: string;
    notificationEnabled: boolean;
    notificationBefore: number;
    notificationRepeatCount: number;
    notificationIntervalMinutes: number;
    notificationSentCount: number;
    nextNotificationAt: string | Date;
    notificationCompleted: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timezone: string;
  }>
) {
  try {
    const idx = memoryReminders.findIndex(r => r.id === id);
    if (idx !== -1) {
      memoryReminders[idx] = {
        ...memoryReminders[idx],
        ...updates,
        reminderTime: updates.reminderTime ? new Date(updates.reminderTime).toISOString() : memoryReminders[idx].reminderTime
      } as any;
    }

    const dataToUpdate: any = { ...updates };
    if (updates.reminderTime) {
      const parsedRTime = new Date(updates.reminderTime);
      dataToUpdate.reminderTime = parsedRTime;
      // Reset next notification time & counts if reminder time changed
      if (updates.nextNotificationAt === undefined) {
        dataToUpdate.nextNotificationAt = parsedRTime;
        dataToUpdate.notificationSentCount = 0;
        dataToUpdate.notificationCompleted = false;
        dataToUpdate.triggered = false;
      }
    }
    if (updates.nextNotificationAt) {
      dataToUpdate.nextNotificationAt = new Date(updates.nextNotificationAt);
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: dataToUpdate,
      include: { task: true }
    });

    try {
      await syncReminderToOutlook(id);
    } catch (syncErr) {
      console.warn("Outlook auto-sync error during reminder update:", syncErr);
    }

    const latest = await prisma.reminder.findUnique({ where: { id }, include: { task: true } });
    const target = latest || updated;

    return mapDbReminderToItem(target);
  } catch (err) {
    console.warn("DB update reminder fallback:", err);
    return memoryReminders.find(r => r.id === id) || null;
  }
}

export async function deleteReminder(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.reminder.findUnique({ where: { id } });
    if (!existing) {
      memoryReminders = memoryReminders.filter(r => r.id !== id);
      return { success: true };
    }

    if (existing.outlookEventId) {
      const delRes = await deleteOutlookEvent(existing.outlookEventId);
      if (!delRes.success) {
        await prisma.reminder.update({
          where: { id },
          data: {
            outlookSyncStatus: 'Failed',
            outlookSyncError: delRes.error || 'Failed to delete Outlook reminder event'
          }
        }).catch(() => {});
        return { success: false, error: delRes.error || 'Failed to delete Outlook event' };
      }
    }

    memoryReminders = memoryReminders.filter(r => r.id !== id);
    await prisma.reminder.delete({ where: { id } });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete reminder' };
  }
}

/**
 * ATOMIC DUE REMINDER CLAIM & TRIGGER PROTECTION
 * Atomically marks due untriggered reminders as triggered on the server.
 * Ensures duplicate notifications are NEVER fired on repeated polling requests.
 */
export async function checkAndTriggerDueReminders(): Promise<ReminderItem[]> {
  const now = new Date();
  const claimedReminders: ReminderItem[] = [];

  try {
    const dueReminders = await prisma.reminder.findMany({
      where: {
        reminderTime: { lte: now },
        triggered: false
      },
      include: { task: true }
    });

    for (const rem of dueReminders) {
      // Atomic claim: update triggered: true ONLY if triggered is currently false
      const result = await prisma.reminder.updateMany({
        where: {
          id: rem.id,
          triggered: false
        },
        data: {
          triggered: true
        }
      });

      // Only include if this process successfully flipped triggered from false -> true
      if (result.count > 0) {
        claimedReminders.push({
          id: rem.id,
          title: rem.title,
          taskId: rem.taskId,
          task: rem.task ? {
            id: rem.task.id,
            title: rem.task.title,
            description: rem.task.description,
            status: rem.task.status,
            priority: rem.task.priority,
            dueDate: rem.task.dueDate,
            dueTime: rem.task.dueTime,
            category: rem.task.category,
            notes: rem.task.notes,
            createdAt: rem.task.createdAt.toISOString(),
            updatedAt: rem.task.updatedAt.toISOString(),
          } : null,
          reminderTime: rem.reminderTime.toISOString(),
          channel: rem.channel,
          triggered: true,
          createdAt: rem.createdAt.toISOString()
        });
      }
    }
  } catch (err) {
    console.warn("DB due reminder claim warning:", err);
    // In-memory fallback claim
    const nowISO = now.toISOString();
    for (const r of memoryReminders) {
      if (r.reminderTime <= nowISO && !r.triggered) {
        r.triggered = true;
        claimedReminders.push(r);
      }
    }
  }

  return claimedReminders;
}

