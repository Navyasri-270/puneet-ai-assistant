import { NextRequest, NextResponse } from 'next/server';
import { getMicrosoftAuthUrl } from '@/lib/outlookAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = getMicrosoftAuthUrl(undefined, req);
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate Microsoft auth URL' },
      { status: 500 }
    );
  }
}
