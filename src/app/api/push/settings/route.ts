import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { updatePushSettings } from '@/lib/pushService';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
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
    return NextResponse.json(
      {
        enabled: true,
        taskNotificationsEnabled: true,
        reminderNotificationsEnabled: true,
        frequencyHours: 3,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'Asia/Kolkata',
        error: error.message,
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    await updatePushSettings(body);
    return NextResponse.json({ success: true, settings: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
