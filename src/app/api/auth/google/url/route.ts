import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate auth URL' }, { status: 500 });
  }
}
