import { NextResponse } from 'next/server';
import { sendDirectTestPushNotification } from '@/lib/pushService';
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
    const result = await sendDirectTestPushNotification();
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || result.message || 'Failed to send test push notification',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      message: result.message,
    });
  } catch (error: any) {
    return sanitizeErrorResponse(error, 'Failed to send test push notification');
  }
}
