import { NextResponse } from 'next/server';
import { generateDailyBriefing } from '@/lib/briefingService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const briefing = await generateDailyBriefing();
    return NextResponse.json({ success: true, briefing });
  } catch (err: any) {
    console.error("GET /api/briefing error:", err);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const briefing = await generateDailyBriefing();
    return NextResponse.json({ success: true, briefing });
  } catch (err: any) {
    console.error("POST /api/briefing error:", err);
    return NextResponse.json({ error: 'Failed to refresh briefing' }, { status: 500 });
  }
}
