import { NextResponse } from 'next/server';
import { updateMemory, deleteMemory } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateMemory(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Memory not found or update failed' }, { status: 404 });
    }
    return NextResponse.json({ success: true, memory: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteMemory(params.id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
