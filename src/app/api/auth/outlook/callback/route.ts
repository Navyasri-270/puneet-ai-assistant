import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getOutlookRedirectUri } from '@/lib/outlookAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  let redirectUri = '';
  try {
    redirectUri = getOutlookRedirectUri(req);
  } catch (e) {
    redirectUri = `${req.nextUrl.origin}/api/auth/outlook/callback`;
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.nextUrl.origin);

  if (error || !code) {
    console.error(`[OutlookCallback] OAuth error: ${error || 'missing_code'}. Description: ${errorDescription || 'No description provided'}`);
    const query = new URLSearchParams({
      outlook_error: error || 'missing_code',
      ...(errorDescription ? { outlook_error_description: errorDescription } : {})
    });
    return NextResponse.redirect(`${origin}/settings?${query.toString()}`);
  }

  try {
    await exchangeCodeForTokens(code, redirectUri, req);
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
