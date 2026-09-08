import { NextResponse } from 'next/server';
import { updateReminder, deleteReminder } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateReminder(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Reminder not found or update failed' }, { status: 404 });
    }
    return NextResponse.json({ success: true, reminder: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteReminder(params.id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
  }
}
