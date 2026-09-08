import { NextResponse } from 'next/server';
import { handleOAuthCallback } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.warn("Google OAuth Authorization Denied:", error);
      return NextResponse.redirect(new URL('/settings?error=oauth_denied', req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?error=missing_code', req.url));
    }

    await handleOAuthCallback(code);

    return NextResponse.redirect(new URL('/settings?connected=true', req.url));
  } catch (err: any) {
    console.error("Google OAuth Callback Error:", err);
    return NextResponse.redirect(new URL('/settings?error=auth_failed', req.url));
  }
}
