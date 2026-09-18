import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updatePushSettings } from '@/lib/pushService';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const sub = await prisma.pushSubscription.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      enabled: sub ? sub.enabled : true,
      taskNotificationsEnabled: sub ? sub.taskNotificationsEnabled : true,
      reminderNotificationsEnabled: sub ? sub.reminderNotificationsEnabled : true,
      frequencyHours: sub ? sub.frequencyHours : 3,
      quietHoursEnabled: sub ? sub.quietHoursEnabled : false,
      quietHoursStart: sub ? sub.quietHoursStart : '22:00',
      quietHoursEnd: sub ? sub.quietHoursEnd : '07:00',
      timezone: sub ? sub.timezone : 'Asia/Kolkata',
      hasSubscription: !!sub,
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    });
  } catch (error: any) {
    return sanitizeErrorResponse(error, 'Failed to fetch push settings');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();

    await updatePushSettings(body);
    return NextResponse.json({ success: true, settings: body });
  } catch (error: any) {
    return sanitizeErrorResponse(error, 'Failed to update push settings');
  }
}
