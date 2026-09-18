import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TIMEZONE } from './dateUtils';

const prisma = new PrismaClient();

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:puneet@puneetcapital.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('Failed to set VAPID details:', err);
  }
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  frequencyHours?: number;
  taskNotificationsEnabled?: boolean;
  reminderNotificationsEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}) {
  return await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      enabled: true,
      frequencyHours: sub.frequencyHours ?? 3,
      taskNotificationsEnabled: sub.taskNotificationsEnabled ?? true,
      reminderNotificationsEnabled: sub.reminderNotificationsEnabled ?? true,
      quietHoursEnabled: sub.quietHoursEnabled ?? false,
      quietHoursStart: sub.quietHoursStart ?? '22:00',
      quietHoursEnd: sub.quietHoursEnd ?? '07:00',
      timezone: sub.timezone ?? DEFAULT_TIMEZONE,
    },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      enabled: true,
      frequencyHours: sub.frequencyHours ?? 3,
      taskNotificationsEnabled: sub.taskNotificationsEnabled ?? true,
      reminderNotificationsEnabled: sub.reminderNotificationsEnabled ?? true,
      quietHoursEnabled: sub.quietHoursEnabled ?? false,
      quietHoursStart: sub.quietHoursStart ?? '22:00',
      quietHoursEnd: sub.quietHoursEnd ?? '07:00',
      timezone: sub.timezone ?? DEFAULT_TIMEZONE,
    },
  });
}

export async function updatePushSettings(params: {
  enabled?: boolean;
  frequencyHours?: number;
  taskNotificationsEnabled?: boolean;
  reminderNotificationsEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}) {
  const subs = await prisma.pushSubscription.findMany();
  for (const sub of subs) {
    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: {
        enabled: params.enabled !== undefined ? params.enabled : sub.enabled,
        frequencyHours: params.frequencyHours !== undefined ? params.frequencyHours : sub.frequencyHours,
        taskNotificationsEnabled: params.taskNotificationsEnabled !== undefined ? params.taskNotificationsEnabled : sub.taskNotificationsEnabled,
        reminderNotificationsEnabled: params.reminderNotificationsEnabled !== undefined ? params.reminderNotificationsEnabled : sub.reminderNotificationsEnabled,
        quietHoursEnabled: params.quietHoursEnabled !== undefined ? params.quietHoursEnabled : sub.quietHoursEnabled,
        quietHoursStart: params.quietHoursStart !== undefined ? params.quietHoursStart : sub.quietHoursStart,
        quietHoursEnd: params.quietHoursEnd !== undefined ? params.quietHoursEnd : sub.quietHoursEnd,
        timezone: params.timezone !== undefined ? params.timezone : sub.timezone,
      },
    });
  }
}

export function isQuietHours(
  quietHoursEnabled: boolean,
  quietHoursStart: string,
  quietHoursEnd: string,
  timezone: string = DEFAULT_TIMEZONE,
  targetDate: Date = new Date()
): boolean {
  if (!quietHoursEnabled || !quietHoursStart || !quietHoursEnd) return false;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(targetDate);
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
    const minStr = parts.find((p) => p.type === 'minute')?.value || '00';
    const currentMins = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);

    const [startH, startM] = quietHoursStart.split(':').map((v) => parseInt(v, 10));
    const [endH, endM] = quietHoursEnd.split(':').map((v) => parseInt(v, 10));

    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (startMins < endMins) {
      return currentMins >= startMins && currentMins < endMins;
    } else {
      // Overnight (e.g. 22:00 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    }
  } catch (err) {
    console.error('Error evaluating quiet hours:', err);
    return false;
  }
}

export async function processAllPushNotifications(force = false): Promise<{
  success: boolean;
  sentCount: number;
  taskBeforeAlertsCount: number;
  taskDueAlertsCount: number;
  reminderBeforeAlertsCount: number;
  reminderDueAlertsCount: number;
  overdueAlertsCount: number;
  summarySentCount: number;
  message?: string;
}> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return {
      success: false,
      sentCount: 0,
      taskBeforeAlertsCount: 0,
      taskDueAlertsCount: 0,
      reminderBeforeAlertsCount: 0,
      reminderDueAlertsCount: 0,
      overdueAlertsCount: 0,
      summarySentCount: 0,
      message: 'VAPID keys not configured in environment',
    };
  }

  const activeSubscriptions = await prisma.pushSubscription.findMany({
    where: { enabled: true },
  });

  if (activeSubscriptions.length === 0) {
    return {
      success: true,
      sentCount: 0,
      taskBeforeAlertsCount: 0,
      taskDueAlertsCount: 0,
      reminderBeforeAlertsCount: 0,
      reminderDueAlertsCount: 0,
      overdueAlertsCount: 0,
      summarySentCount: 0,
      message: 'No active push subscriptions registered',
    };
  }

  const now = new Date();
  const nowMs = now.getTime();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://assistant.puneetcapital.com';

  let sentCount = 0;
  let taskBeforeAlertsCount = 0;
  let taskDueAlertsCount = 0;
  let reminderBeforeAlertsCount = 0;
  let reminderDueAlertsCount = 0;
  let overdueAlertsCount = 0;
  let summarySentCount = 0;

  // Helper to send web push payload across subscriptions
  // STRICT RULE: ONLY HTTP 404 AND 410 DELETE SUBSCRIPTIONS. TEMPORARY ERRORS RETAIN THEM.
  async function dispatchToSubscriptions(
    payload: any,
    filterFn?: (sub: any) => boolean
  ): Promise<number> {
    let dispatched = 0;
    for (const sub of activeSubscriptions) {
      if (filterFn && !filterFn(sub)) continue;

      const pushConfig = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      try {
        await webpush.sendNotification(pushConfig, JSON.stringify(payload));
        dispatched++;
      } catch (err: any) {
        console.error(`Push delivery error for ${sub.endpoint}:`, err.statusCode || err.message || err);
        // STRICT CLEANUP ONLY ON HTTP 404 OR 410
        if (err.statusCode === 404 || err.statusCode === 410) {
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            console.log(`Cleaned up stale subscription ${sub.id} (HTTP ${err.statusCode})`);
          } catch (delErr) {
            console.error('Error deleting stale subscription:', delErr);
          }
        } else {
          // Temporary error (500, 502, 503, timeout) -> RETAIN SUBSCRIPTION FOR RETRY
          console.warn(`Temporary push error (HTTP ${err.statusCode || 'network'}), subscription ${sub.id} retained for retry.`);
        }
      }
    }
    return dispatched;
  }

  // --- STAGE 1: Task Due & Notification-Before Alerts (ATOMIC DB CLAIMS) ---
  const activeTasks = await prisma.task.findMany({
    where: {
      NOT: [
        { status: 'Completed' },
        { status: 'Done' },
        { status: 'Cancelled' },
      ],
      notificationEnabled: true,
    },
  });

  for (const task of activeTasks) {
    if (!task.dueDate) continue;

    const dueTimestamp = task.dueTime
      ? new Date(`${task.dueDate}T${task.dueTime}:00`).getTime()
      : new Date(`${task.dueDate}T09:00:00`).getTime();

    if (isNaN(dueTimestamp)) continue;

    const notificationBeforeMs = (task.notificationBefore || 0) * 60 * 1000;
    const triggerTimeBeforeMs = dueTimestamp - notificationBeforeMs;

    // 1A: Notification-Before Alert (Atomic DB Claim)
    if (
      task.notificationBefore > 0 &&
      !task.beforeNotifiedAt &&
      nowMs >= triggerTimeBeforeMs &&
      nowMs < dueTimestamp
    ) {
      const claim = await prisma.task.updateMany({
        where: { id: task.id, beforeNotifiedAt: null },
        data: { beforeNotifiedAt: now, lastNotifiedAt: now },
      });

      if (claim.count > 0) {
        const payload = {
          title: `⏰ Upcoming Task (${task.notificationBefore}m before): ${task.title}`,
          body: `Priority: ${task.priority} | Category: ${task.category}${task.dueTime ? ` | Due at ${task.dueTime}` : ''}`,
          url: `${appUrl}/tasks`,
          tag: `task-before-${task.id}`,
          taskId: task.id,
        };

        const delivered = await dispatchToSubscriptions(payload, (sub) => {
          if (!sub.taskNotificationsEnabled) return false;
          if (!force && isQuietHours(sub.quietHoursEnabled, sub.quietHoursStart, sub.quietHoursEnd, sub.timezone, now)) {
            return false;
          }
          return true;
        });

        taskBeforeAlertsCount++;
        sentCount += delivered;
      }
    }

    // 1B: Exact Due-Time Alert (Atomic DB Claim)
    if (!task.dueNotifiedAt && nowMs >= dueTimestamp) {
      const claim = await prisma.task.updateMany({
        where: { id: task.id, dueNotifiedAt: null },
        data: { dueNotifiedAt: now, notificationSent: true, lastNotifiedAt: now },
      });

      if (claim.count > 0) {
        const payload = {
          title: `🔔 Task Due: ${task.title}`,
          body: `Priority: ${task.priority} | Category: ${task.category}${task.dueTime ? ` | Due at ${task.dueTime}` : ''}`,
          url: `${appUrl}/tasks`,
          tag: `task-due-${task.id}`,
          taskId: task.id,
        };

        const delivered = await dispatchToSubscriptions(payload, (sub) => {
          if (!sub.taskNotificationsEnabled) return false;
          if (!force && isQuietHours(sub.quietHoursEnabled, sub.quietHoursStart, sub.quietHoursEnd, sub.timezone, now)) {
            return false;
          }
          return true;
        });

        taskDueAlertsCount++;
        sentCount += delivered;
      }
    }
  }

  // --- STAGE 2: Reminder Due & Repeat Notification Alerts (ATOMIC DB CLAIMS) ---
  const activeReminders = await prisma.reminder.findMany({
    where: {
      notificationEnabled: true,
      notificationCompleted: false,
    },
  });

  for (const rem of activeReminders) {
    const reminderMs = new Date(rem.reminderTime).getTime();
    if (isNaN(reminderMs)) continue;

    const notificationBeforeMs = (rem.notificationBefore || 0) * 60 * 1000;
    const triggerTimeBeforeMs = reminderMs - notificationBeforeMs;

    // 2A: Reminder Notification-Before Alert (Atomic DB Claim)
    if (
      rem.notificationBefore > 0 &&
      !rem.beforeNotifiedAt &&
      nowMs >= triggerTimeBeforeMs &&
      nowMs < reminderMs
    ) {
      const claim = await prisma.reminder.updateMany({
        where: { id: rem.id, beforeNotifiedAt: null },
        data: { beforeNotifiedAt: now, lastNotifiedAt: now, lastNotificationAt: now },
      });

      if (claim.count > 0) {
        const payload = {
          title: `⏰ Upcoming Reminder (${rem.notificationBefore}m before): ${rem.title}`,
          body: `Scheduled for ${new Date(rem.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          url: `${appUrl}/calendar`,
          tag: `reminder-before-${rem.id}`,
          reminderId: rem.id,
        };

        const delivered = await dispatchToSubscriptions(payload, (sub) => {
          if (!sub.reminderNotificationsEnabled) return false;
          if (!force && (
            isQuietHours(sub.quietHoursEnabled, sub.quietHoursStart, sub.quietHoursEnd, sub.timezone, now) ||
            isQuietHours(rem.quietHoursEnabled, rem.quietHoursStart || '22:00', rem.quietHoursEnd || '07:00', rem.timezone || DEFAULT_TIMEZONE, now)
          )) {
            return false;
          }
          return true;
        });

        reminderBeforeAlertsCount++;
        sentCount += delivered;
      }
    }

    // 2B: Reminder Due & Repeat Notification Alert (Atomic DB Claim)
    const nextNotifyMs = rem.nextNotificationAt
      ? new Date(rem.nextNotificationAt).getTime()
      : reminderMs;

    const repeatLimit = Math.max(1, rem.notificationRepeatCount || 1);
    const intervalMins = Math.max(5, rem.notificationIntervalMinutes || 15);

    if (
      nowMs >= nextNotifyMs &&
      rem.notificationSentCount < repeatLimit &&
      !rem.notificationCompleted
    ) {
      const newSentCount = rem.notificationSentCount + 1;
      const isCompleted = newSentCount >= repeatLimit;
      const nextTime = new Date(nextNotifyMs + intervalMins * 60 * 1000);

      const claim = await prisma.reminder.updateMany({
        where: {
          id: rem.id,
          notificationSentCount: rem.notificationSentCount,
          notificationCompleted: false,
        },
        data: {
          notificationSentCount: newSentCount,
          notificationSent: true,
          lastNotifiedAt: now,
          lastNotificationAt: now,
          nextNotificationAt: nextTime,
          notificationCompleted: isCompleted,
          triggered: isCompleted,
          dueNotifiedAt: rem.dueNotifiedAt || now,
        },
      });

      if (claim.count > 0) {
        const payload = {
          title: repeatLimit > 1
            ? `🔔 Executive Reminder (${newSentCount}/${repeatLimit}): ${rem.title}`
            : `🔔 Executive Reminder: ${rem.title}`,
          body: `Scheduled for ${new Date(rem.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${repeatLimit > 1 ? ` | Notification ${newSentCount} of ${repeatLimit}` : ''}`,
          url: `${appUrl}/calendar`,
          tag: `reminder-due-${rem.id}-${newSentCount}`,
          reminderId: rem.id,
        };

        const delivered = await dispatchToSubscriptions(payload, (sub) => {
          if (!sub.reminderNotificationsEnabled) return false;
          if (!force && (
            isQuietHours(sub.quietHoursEnabled, sub.quietHoursStart, sub.quietHoursEnd, sub.timezone, now) ||
            isQuietHours(rem.quietHoursEnabled, rem.quietHoursStart || '22:00', rem.quietHoursEnd || '07:00', rem.timezone || DEFAULT_TIMEZONE, now)
          )) {
            return false;
          }
          return true;
        });

        reminderDueAlertsCount++;
        sentCount += delivered;
      }
    }
  }

  // --- STAGE 3: Overdue Warnings (Atomic DB Claim) ---
  const overdueTasks = await prisma.task.findMany({
    where: {
      NOT: [
        { status: 'Completed' },
        { status: 'Done' },
        { status: 'Cancelled' },
      ],
      notificationEnabled: true,
    },
  });

  for (const task of overdueTasks) {
    if (!task.dueDate) continue;
    const dueTimestamp = task.dueTime
      ? new Date(`${task.dueDate}T${task.dueTime}:00`).getTime()
      : new Date(`${task.dueDate}T23:59:59`).getTime();

    if (nowMs > dueTimestamp + 5 * 60 * 1000) {
      const hoursSinceOverdueNotified = task.overdueNotifiedAt
        ? (nowMs - new Date(task.overdueNotifiedAt).getTime()) / 3600000
        : 999;

      if (hoursSinceOverdueNotified >= 24) {
        const claim = await prisma.task.updateMany({
          where: { id: task.id, overdueNotifiedAt: task.overdueNotifiedAt },
          data: { overdueNotifiedAt: now, lastNotifiedAt: now },
        });

        if (claim.count > 0) {
          const payload = {
            title: `⚠️ Overdue Task Warning: ${task.title}`,
            body: `Task was due on ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ''}. Tap to review.`,
            url: `${appUrl}/tasks`,
            tag: `overdue-task-${task.id}`,
          };

          const delivered = await dispatchToSubscriptions(payload, (sub) => {
            if (!sub.taskNotificationsEnabled) return false;
            const isUrgent = task.priority === 'Urgent';
            if (!force && !isUrgent && isQuietHours(sub.quietHoursEnabled, sub.quietHoursStart, sub.quietHoursEnd, sub.timezone, now)) {
              return false;
            }
            return true;
          });

          overdueAlertsCount++;
          sentCount += delivered;
        }
      }
    }
  }

  // --- STAGE 4: Grouped 3-Hour Pending Summary (Independent lastSummaryNotifiedAt) ---
  const pendingTasksList = await prisma.task.findMany({
    where: {
      NOT: [{ status: 'Completed' }, { status: 'Done' }, { status: 'Cancelled' }],
    },
  });

  const totalPending = pendingTasksList.length;

  if (totalPending > 0) {
    for (const sub of activeSubscriptions) {
      if (sub.frequencyHours <= 0) continue;

      const hoursSinceLastSummary = sub.lastSummaryNotifiedAt
        ? (nowMs - new Date(sub.lastSummaryNotifiedAt).getTime()) / 3600000
        : 999;

      if (force || hoursSinceLastSummary >= sub.frequencyHours) {
        if (!force && isQuietHours(sub.quietHoursEnabled, sub.quietHoursStart, sub.quietHoursEnd, sub.timezone, now)) {
          continue;
        }

        const claim = await prisma.pushSubscription.updateMany({
          where: { id: sub.id, lastSummaryNotifiedAt: sub.lastSummaryNotifiedAt },
          data: { lastSummaryNotifiedAt: now, lastNotifiedAt: now },
        });

        if (claim.count > 0) {
          const payload = {
            title: '📋 Executive Task Summary',
            body: `You have ${totalPending} pending task${totalPending > 1 ? 's' : ''} requiring attention.`,
            url: `${appUrl}/tasks`,
            tag: 'puneet-ai-summary',
            pendingCount: totalPending,
          };

          const pushConfig = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };

          try {
            await webpush.sendNotification(pushConfig, JSON.stringify(payload));
            summarySentCount++;
            sentCount++;
          } catch (err: any) {
            console.error(`Failed summary push to ${sub.endpoint}:`, err.statusCode || err.message);
            if (err.statusCode === 404 || err.statusCode === 410) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
            }
          }
        }
      }
    }
  }

  return {
    success: true,
    sentCount,
    taskBeforeAlertsCount,
    taskDueAlertsCount,
    reminderBeforeAlertsCount,
    reminderDueAlertsCount,
    overdueAlertsCount,
    summarySentCount,
    message: `Processed push alerts: ${taskBeforeAlertsCount} task-before, ${taskDueAlertsCount} task-due, ${reminderBeforeAlertsCount} reminder-before, ${reminderDueAlertsCount} reminder-due, ${overdueAlertsCount} overdue, ${summarySentCount} summary push(es) dispatched.`,
  };
}

// Backward compatibility helper
export async function sendGroupedPendingTaskPushNotification(force = false) {
  const result = await processAllPushNotifications(force);
  return {
    success: result.success,
    sentCount: result.sentCount,
    pendingTaskCount: result.taskDueAlertsCount + result.summarySentCount,
    message: result.message,
  };
}
