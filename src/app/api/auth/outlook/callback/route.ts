import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/outlookAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code) {
    console.error(`[OutlookCallback] OAuth error: ${error || 'missing_code'}. Description: ${errorDescription || 'No description provided'}`);
    const query = new URLSearchParams({
      outlook_error: error || 'missing_code',
      ...(errorDescription ? { outlook_error_description: errorDescription } : {})
    });
    return NextResponse.redirect(`${origin}/settings?${query.toString()}`);
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(`${origin}/settings?outlook=connected`);
  } catch (err: any) {
    console.error('[OutlookCallback] Exchange Microsoft code error:', err.message || err);
    const query = new URLSearchParams({
      outlook_error: 'exchange_failed',
      outlook_error_description: err.message || 'Token exchange failed'
    });
    return NextResponse.redirect(`${origin}/settings?${query.toString()}`);
  }
}
