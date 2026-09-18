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
    const { title, reminderTime, taskId, channel } = body;

    if (!reminderTime || typeof reminderTime !== 'string') {
      return NextResponse.json({ error: 'Valid ISO reminderTime is required' }, { status: 400 });
    }

    const reminder = await createReminder({
      title: title || 'Executive Reminder',
      reminderTime,
      taskId: taskId || undefined,
      channel: channel || 'In-App'
    });

    return NextResponse.json({ success: true, reminder }, { status: 201 });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to create reminder');
  }
}
