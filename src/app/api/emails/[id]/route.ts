import { NextRequest, NextResponse } from 'next/server';
import { getEmailDraftById, updateEmailDraft, deleteEmailDraft } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const draft = await getEmailDraftById(params.id);
    if (!draft) {
      return NextResponse.json({ error: 'Email draft not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, draft });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to fetch email draft');
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const updated = await updateEmailDraft(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Email draft not found or update failed' }, { status: 404 });
    }
    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to update email draft');
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return PATCH(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const deleted = await deleteEmailDraft(params.id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to delete email draft');
  }
}
