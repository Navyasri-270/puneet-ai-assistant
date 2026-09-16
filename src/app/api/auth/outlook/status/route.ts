import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { disconnectMicrosoftAccount } from '@/lib/outlookAuth';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conn = await prisma.microsoftConnection.findUnique({ where: { id: 'primary' } });
    if (!conn || !conn.isConnected) {
      return NextResponse.json({ isConnected: false });
    }

    return NextResponse.json({
      isConnected: true,
      email: conn.email || 'Outlook Connected',
      expiryDate: conn.expiryDate,
    });
  } catch (error: any) {
    return NextResponse.json({ isConnected: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await disconnectMicrosoftAccount();
    return NextResponse.json({ success: true, isConnected: false });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
