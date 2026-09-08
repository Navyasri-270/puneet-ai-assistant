import { NextResponse } from 'next/server';
import { checkAndTriggerDueReminders } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dueReminders = await checkAndTriggerDueReminders();
    return NextResponse.json({ success: true, dueReminders });
  } catch (err: any) {
    console.error("GET /api/reminders/due error:", err);
    return NextResponse.json({ error: 'Failed to check due reminders' }, { status: 500 });
  }
}
