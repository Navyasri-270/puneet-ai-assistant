import { NextResponse } from 'next/server';
import { processAllPushNotifications } from '@/lib/pushService';
import { sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  return sendTestPush();
}

export async function GET() {
  return sendTestPush();
}

async function sendTestPush() {
  try {
    const result = await processAllPushNotifications(true);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message || 'Failed to dispatch push notification' }, { status: 400 });
    }

    if (result.sentCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active device subscriptions found in database. Please click "Enable Notifications" first to register this device.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      message: `✓ Test Web Push notification sent successfully to ${result.sentCount} registered device(s)!`,
    });
  } catch (error: any) {
    return sanitizeErrorResponse(error, 'Failed to send test push notification');
  }
}
