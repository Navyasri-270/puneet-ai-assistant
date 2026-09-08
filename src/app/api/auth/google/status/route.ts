import { NextResponse } from 'next/server';
import { getGoogleConnectionStatus, disconnectGoogleAccount } from '@/lib/googleAuth';

export async function GET() {
  try {
    const status = await getGoogleConnectionStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const success = await disconnectGoogleAccount();
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
