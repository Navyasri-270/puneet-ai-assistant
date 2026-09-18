import { NextRequest, NextResponse } from 'next/server';
import { checkAndTriggerDueReminders } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const dueReminders = await checkAndTriggerDueReminders();
    return NextResponse.json({ success: true, dueReminders });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to check due reminders');
  }
}
