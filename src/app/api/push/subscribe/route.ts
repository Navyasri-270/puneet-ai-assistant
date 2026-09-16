import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/pushService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.endpoint || !body.keys || !body.keys.p256dh || !body.keys.auth) {
      return NextResponse.json({ success: false, error: 'Invalid push subscription payload' }, { status: 400 });
    }

    const saved = await savePushSubscription(body);
    return NextResponse.json({ success: true, subscriptionId: saved.id });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save push subscription' }, { status: 500 });
  }
}
