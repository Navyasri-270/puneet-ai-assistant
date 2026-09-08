import { NextResponse } from 'next/server';
import { getReminders, createReminder, seedInitialDatabase } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await seedInitialDatabase();
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('filter') as any) || 'all';

    const reminders = await getReminders(filter);
    return NextResponse.json({ success: true, reminders });
  } catch (err: any) {
    console.error("GET /api/reminders error:", err);
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, reminderTime, taskId, channel } = body;

    if (!reminderTime) {
      return NextResponse.json({ error: 'reminderTime is required' }, { status: 400 });
    }

    const reminder = await createReminder({
      title: title || 'Executive Reminder',
      reminderTime,
      taskId: taskId || undefined,
      channel: channel || 'In-App'
    });

    return NextResponse.json({ success: true, reminder }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/reminders error:", err);
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}
