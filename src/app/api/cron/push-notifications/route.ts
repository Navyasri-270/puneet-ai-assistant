import { NextRequest, NextResponse } from 'next/server';
import { processAllPushNotifications } from '@/lib/pushService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleCronJob(req);
}

export async function POST(req: NextRequest) {
  return handleCronJob(req);
}

async function handleCronJob(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get('secret');

    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : querySecret;
    if (token !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Invalid Cron Secret' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === 'true';

  try {
    const result = await processAllPushNotifications(force);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('Unhandled error during cron push notification job execution:', error);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message || 'Internal cron execution failure',
      },
      { status: 500 }
    );
  }
}
