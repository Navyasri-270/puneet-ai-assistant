import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { updatePushSettings } from '@/lib/pushService';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sub = await prisma.pushSubscription.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      enabled: sub ? sub.enabled : true,
      frequencyHours: sub ? sub.frequencyHours : 3,
      hasSubscription: !!sub,
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    });
  } catch (error: any) {
    return NextResponse.json({ enabled: true, frequencyHours: 3, error: error.message, vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { enabled, frequencyHours } = body;

    await updatePushSettings({ enabled, frequencyHours });
    return NextResponse.json({ success: true, enabled, frequencyHours });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
