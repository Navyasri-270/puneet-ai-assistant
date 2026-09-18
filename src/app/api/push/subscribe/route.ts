import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/pushService';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    if (!body.endpoint || !body.keys || !body.keys.p256dh || !body.keys.auth) {
      return NextResponse.json({ success: false, error: 'Invalid push subscription payload' }, { status: 400 });
    }

    const saved = await savePushSubscription(body);
    return NextResponse.json({ success: true, subscriptionId: saved.id });
  } catch (error: any) {
    return sanitizeErrorResponse(error, 'Failed to save push subscription');
  }
}
