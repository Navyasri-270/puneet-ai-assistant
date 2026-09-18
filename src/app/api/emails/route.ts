import { NextRequest, NextResponse } from 'next/server';
import { getEmailDrafts, createEmailDraft } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    let drafts = await getEmailDrafts();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
    const status = searchParams.get('status');

    if (status && status !== 'All') {
      drafts = drafts.filter(d => d.status === status);
    }

    if (search) {
      drafts = drafts.filter(d => 
        d.recipient.toLowerCase().includes(search) || 
        d.subject.toLowerCase().includes(search) || 
        d.body.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, drafts });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to fetch email drafts');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const { recipient, cc, bcc, subject, body: emailBody, status } = body;

    const draft = await createEmailDraft({
      recipient: recipient || '',
      cc: cc || '',
      bcc: bcc || '',
      subject: subject || 'No Subject',
      body: emailBody || '',
      status: status || 'Draft'
    });

    return NextResponse.json({ success: true, draft }, { status: 201 });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to create email draft');
  }
}
