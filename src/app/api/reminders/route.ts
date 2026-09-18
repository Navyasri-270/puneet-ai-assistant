import { NextRequest, NextResponse } from 'next/server';
import { getReminders, createReminder } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('filter') as any) || 'all';

    const reminders = await getReminders(filter);
    return NextResponse.json({ success: true, reminders });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to fetch reminders');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const {
      title,
      reminderTime,
      taskId,
      channel,
      notificationEnabled,
      notificationBefore,
      notificationRepeatCount,
      notificationIntervalMinutes,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      timezone,
    } = body;

    if (!reminderTime || typeof reminderTime !== 'string') {
      return NextResponse.json({ error: 'Valid ISO reminderTime is required' }, { status: 400 });
    }

    const reminder = await createReminder({
      title: title || 'Executive Reminder',
      reminderTime,
      taskId: taskId || undefined,
      channel: channel || 'In-App',
      notificationEnabled: notificationEnabled !== undefined ? Boolean(notificationEnabled) : true,
      notificationBefore: notificationBefore !== undefined ? Number(notificationBefore) : 15,
      notificationRepeatCount: notificationRepeatCount !== undefined ? Number(notificationRepeatCount) : 1,
      notificationIntervalMinutes: notificationIntervalMinutes !== undefined ? Number(notificationIntervalMinutes) : 15,
      quietHoursEnabled: quietHoursEnabled !== undefined ? Boolean(quietHoursEnabled) : false,
      quietHoursStart: quietHoursStart || '22:00',
      quietHoursEnd: quietHoursEnd || '07:00',
      timezone: timezone || 'Asia/Kolkata',
    });

    return NextResponse.json({ success: true, reminder }, { status: 201 });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to create reminder');
  }
}
