import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getOutlookConfig, getValidMicrosoftAccessToken } from '@/lib/outlookAuth';
import { fetchOutlookEvents } from '@/lib/outlookService';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getOutlookConfig();
  
  const envCheck = {
    hasClientId: Boolean(config.clientId),
    hasClientSecret: Boolean(config.clientSecret),
    tenantId: config.tenantId,
    tenantEndpoint: `https://login.microsoftonline.com/${config.tenantId}`,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
  };

  try {
    const conn = await prisma.microsoftConnection.findUnique({ where: { id: 'primary' } });
    const isConnectedInDb = Boolean(conn && conn.isConnected);

    if (!isConnectedInDb) {
      return NextResponse.json({
        success: false,
        env: envCheck,
        isConnected: false,
        tokenValid: false,
        canReadCalendar: false,
        email: conn?.email || null,
        message: 'Microsoft Outlook account is not connected.',
      });
    }

    // Test token validity
    const token = await getValidMicrosoftAccessToken();
    if (!token) {
      return NextResponse.json({
        success: false,
        env: envCheck,
        isConnected: false,
        tokenValid: false,
        canReadCalendar: false,
        email: conn?.email || null,
        message: 'Stored Microsoft access token is invalid or expired refresh token flow failed.',
      });
    }

    // Test reading calendar events via Graph API
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const result = await fetchOutlookEvents(today, tomorrow);

    if (result.error) {
      return NextResponse.json({
        success: false,
        env: envCheck,
        isConnected: true,
        tokenValid: true,
        canReadCalendar: false,
        email: conn?.email || null,
        error: result.error,
        message: `Token valid, but Microsoft Graph Calendar read failed: ${result.error}`,
      });
    }

    return NextResponse.json({
      success: true,
      env: envCheck,
      isConnected: true,
      tokenValid: true,
      canReadCalendar: true,
      email: conn?.email || null,
      eventCount: result.events.length,
      message: `Outlook connection, token validity, and Microsoft Graph Calendar read verified successfully. (${result.events.length} test event(s) found).`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        env: envCheck,
        isConnected: false,
        tokenValid: false,
        canReadCalendar: false,
        error: error.message || 'Diagnostic connection test failed',
      },
      { status: 500 }
    );
  }
}
