import { prisma } from './db';
import { TaskItem, ReminderItem } from './taskStore';

export interface StructuredIntent {
  type: 'task' | 'reminder' | 'event' | 'note' | 'chat';
  title: string;
  description: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM AM/PM or HH:MM
  recurrence: string; // 'none' | 'daily' | 'weekly' | 'monthly'
  priority?: string;  // 'Low' | 'Medium' | 'High' | 'Urgent'
  category?: string;
  location?: string;
}

// In-Memory Idempotency Cache (TTL 15 mins)
const requestIdCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cleanExpiredCache() {
  const now = Date.now();
  requestIdCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL_MS) {
      requestIdCache.delete(key);
    }
  });
}

/**
 * Gets cached response for a unique request/message ID if already processed.
 */
export function getCachedRequestResponse(requestId?: string | null): any | null {
  if (!requestId) return null;
  cleanExpiredCache();
  const entry = requestIdCache.get(requestId);
  return entry ? entry.response : null;
}

/**
 * Stores processed response for idempotency protection.
 */
export function setCachedRequestResponse(requestId: string | null | undefined, response: any): void {
  if (!requestId) return;
  cleanExpiredCache();
  requestIdCache.set(requestId, { response, timestamp: Date.now() });
}

/**
 * Normalizes a title for robust fuzzy duplicate detection.
 */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if an identical active task already exists in the database or memory store.
 */
export async function findDuplicateTask(title: string, dueDate?: string, dueTime?: string): Promise<TaskItem | null> {
  const normTarget = normalizeTitle(title);
  if (!normTarget || normTarget.length < 2) return null;

  try {
    const tasks = await prisma.task.findMany({
      where: {
        status: { notIn: ['Completed', 'Done', 'Cancelled'] }
      }
    });

    for (const t of tasks) {
      const normExisting = normalizeTitle(t.title);
      const isTitleMatch = normExisting === normTarget || normExisting.includes(normTarget) || normTarget.includes(normExisting);
      
      if (isTitleMatch) {
        if (!dueDate || !t.dueDate || t.dueDate === dueDate) {
          return {
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate || '',
            dueTime: t.dueTime || '',
            category: t.category,
            notes: t.notes || '',
            outlookEventId: t.outlookEventId,
            outlookSyncStatus: t.outlookSyncStatus,
            outlookSyncError: t.outlookSyncError,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          };
        }
      }
    }
  } catch (err) {
    console.warn('[TaskDeduplication] DB query warning:', err);
  }

  return null;
}

/**
 * Checks if an identical active reminder already exists in the database.
 */
export async function findDuplicateReminder(title: string, reminderTimeISO: string): Promise<ReminderItem | null> {
  const normTarget = normalizeTitle(title);
  if (!normTarget) return null;

  const targetDateStr = reminderTimeISO.split('T')[0];

  try {
    const reminders = await prisma.reminder.findMany({
      where: { triggered: false }
    });

    for (const r of reminders) {
      const normExisting = normalizeTitle(r.title);
      const rDateStr = r.reminderTime.toISOString().split('T')[0];
      if ((normExisting === normTarget || normTarget.includes(normExisting)) && rDateStr === targetDateStr) {
        return {
          id: r.id,
          title: r.title,
          reminderTime: r.reminderTime.toISOString(),
          channel: r.channel,
          triggered: r.triggered,
          createdAt: r.createdAt.toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('[TaskDeduplication] DB reminder check warning:', err);
  }

  return null;
}
