import { NextResponse } from 'next/server';
import { getEmailDrafts, createEmailDraft } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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
    console.error("GET /api/emails error:", err);
    return NextResponse.json({ error: 'Failed to fetch email drafts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    console.error("POST /api/emails error:", err);
    return NextResponse.json({ error: 'Failed to create email draft' }, { status: 500 });
  }
}
