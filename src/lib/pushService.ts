import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

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
}) {
  return await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      enabled: true,
      frequencyHours: sub.frequencyHours ?? 3,
    },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      enabled: true,
      frequencyHours: sub.frequencyHours ?? 3,
    },
  });
}

export async function updatePushSettings(params: { enabled?: boolean; frequencyHours?: number }) {
  const subs = await prisma.pushSubscription.findMany();
  for (const sub of subs) {
    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: {
        enabled: params.enabled !== undefined ? params.enabled : sub.enabled,
        frequencyHours: params.frequencyHours !== undefined ? params.frequencyHours : sub.frequencyHours,
      },
    });
  }
}

export async function sendGroupedPendingTaskPushNotification(force = false): Promise<{
  success: boolean;
  sentCount: number;
  pendingTaskCount: number;
  message?: string;
}> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return {
      success: false,
      sentCount: 0,
      pendingTaskCount: 0,
      message: 'VAPID keys not configured in environment',
    };
  }

  // 1. Fetch pending tasks from database
  const pendingTasks = await prisma.task.findMany({
    where: {
      NOT: [
        { status: 'Completed' },
        { status: 'Done' },
      ],
    },
  });

  const count = pendingTasks.length;
  if (count === 0) {
    return {
      success: true,
      sentCount: 0,
      pendingTaskCount: 0,
      message: 'No pending tasks to notify',
    };
  }

  // 2. Fetch active subscriptions
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { enabled: true },
  });

  if (subscriptions.length === 0) {
    return {
      success: true,
      sentCount: 0,
      pendingTaskCount: count,
      message: 'No active push subscriptions registered',
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://assistant.puneetcapital.com';

  const payload = JSON.stringify({
    title: '🔔 Puneet AI Assistant',
    body: `You have ${count} pending task${count > 1 ? 's' : ''}.\nTap to view your tasks.`,
    url: `${appUrl}/tasks`,
    tag: 'puneet-ai-tasks',
    pendingCount: count,
  });

  let sentCount = 0;

  for (const sub of subscriptions) {
    // Check frequency window unless forced
    if (!force && sub.lastNotifiedAt && sub.frequencyHours > 0) {
      const hoursSinceLast = (Date.now() - new Date(sub.lastNotifiedAt).getTime()) / 3600000;
      if (hoursSinceLast < sub.frequencyHours) {
        console.log(`Skipping notification for sub ${sub.id}, only ${hoursSinceLast.toFixed(2)}h passed (frequency: ${sub.frequencyHours}h)`);
        continue;
      }
    }

    const pushConfig = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushConfig, payload);
      sentCount++;
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastNotifiedAt: new Date() },
      });
    } catch (err: any) {
      console.error(`Failed to send push notification to ${sub.endpoint}:`, err);
      // Remove stale/expired subscriptions (404, 410)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }

  return {
    success: true,
    sentCount,
    pendingTaskCount: count,
    message: `Dispatched grouped push notification to ${sentCount} device(s) for ${count} pending task(s)`,
  };
}
