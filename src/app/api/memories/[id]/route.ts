import { NextRequest, NextResponse } from 'next/server';
import { updateMemory, deleteMemory } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const updated = await updateMemory(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Memory not found or update failed' }, { status: 404 });
    }
    return NextResponse.json({ success: true, memory: updated });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to update memory');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const deleted = await deleteMemory(params.id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to delete memory');
  }
}
