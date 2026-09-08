import { NextResponse } from 'next/server';
import { getEmailDraftById, updateEmailDraft, deleteEmailDraft } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const draft = await getEmailDraftById(params.id);
    if (!draft) {
      return NextResponse.json({ error: 'Email draft not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, draft });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch email draft' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateEmailDraft(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Email draft not found or update failed' }, { status: 404 });
    }
    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update email draft' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return PATCH(req, { params });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteEmailDraft(params.id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete email draft' }, { status: 500 });
  }
}
