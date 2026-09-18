import { NextRequest, NextResponse } from 'next/server';
import { updateReminder, deleteReminder } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const updated = await updateReminder(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Reminder not found or update failed' }, { status: 404 });
    }
    return NextResponse.json({ success: true, reminder: updated });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to update reminder');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const result = await deleteReminder(params.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete reminder' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to delete reminder');
  }
}
