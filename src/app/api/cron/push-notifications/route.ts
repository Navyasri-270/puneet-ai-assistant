import { NextRequest, NextResponse } from 'next/server';
import { processAllPushNotifications } from '@/lib/pushService';
import { validateCronAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleCronJob(req);
}

export async function POST(req: NextRequest) {
  return handleCronJob(req);
}

async function handleCronJob(req: NextRequest) {
  // STRICT CRON_SECRET VALIDATION: REJECT IF MISSING OR INVALID
  const auth = validateCronAuth(req);
  if (!auth.authorized && auth.response) {
    return auth.response;
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
    return sanitizeErrorResponse(error, 'Cron execution failure processing push notifications');
  }
}
