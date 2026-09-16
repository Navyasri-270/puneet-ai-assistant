import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCOPES = ['openid', 'profile', 'User.Read', 'Calendars.Read', 'offline_access'].join(' ');

export function getOutlookConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  
  let redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';
  if (!redirectUri) {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/outlook/callback`;
    } else {
      redirectUri = 'http://localhost:3000/api/auth/outlook/callback';
    }
  }

  return { clientId, clientSecret, tenantId, redirectUri, scopes: SCOPES };
}

export function getMicrosoftAuthUrl(state?: string): string {
  const { clientId, tenantId, redirectUri } = getOutlookConfig();

  console.log(`[OutlookAuth] Generating auth URL. Client ID present: ${Boolean(clientId)}, Tenant: ${tenantId}, Redirect URI: ${redirectUri}`);

  if (!clientId) {
    console.error('[OutlookAuth] Error: MICROSOFT_CLIENT_ID is missing from environment variables.');
    throw new Error('MICROSOFT_CLIENT_ID is not configured in environment variables.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    prompt: 'select_account',
  });

  if (state) {
    params.set('state', state);
  }

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  console.log(`[OutlookAuth] OAuth URL generated successfully: ${authUrl.replace(clientId, '***CLIENT_ID***')}`);
  return authUrl;
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, tenantId, redirectUri } = getOutlookConfig();

  console.log(`[OutlookAuth] Exchanging authorization code for tokens (Tenant: ${tenantId}, Redirect URI: ${redirectUri})...`);

  if (!clientId) {
    console.error('[OutlookAuth] Error: MICROSOFT_CLIENT_ID is missing during code exchange.');
    throw new Error('MICROSOFT_CLIENT_ID is not configured in environment variables.');
  }
  if (!clientSecret) {
    console.error('[OutlookAuth] Error: MICROSOFT_CLIENT_SECRET is missing during code exchange.');
    throw new Error('MICROSOFT_CLIENT_SECRET is not configured in environment variables.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPES,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    let sanitizedErr = errText;
    let errCode = null;
    try {
      const errJson = JSON.parse(errText);
      sanitizedErr = errJson.error_description || errJson.error || errText;
      errCode = errJson.error || null;
    } catch (e) {}
    console.error(`[OutlookAuth] Token exchange failed with HTTP status ${res.status}: ${sanitizedErr}`);
    throw new Error(`Failed to exchange authorization code: ${sanitizedErr}`);
  }

  const data = await res.json();
  const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  // Fetch user profile email safely
  let email: string | null = null;
  try {
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      email = userData.mail || userData.userPrincipalName || null;
      console.log(`[OutlookAuth] Microsoft profile verified. User email: ${email || 'unknown'}`);
    } else {
      console.warn(`[OutlookAuth] Profile fetch status: ${userRes.status}`);
    }
  } catch (err: any) {
    console.error('[OutlookAuth] Failed to fetch Microsoft user profile:', err.message || err);
  }

  await prisma.microsoftConnection.upsert({
    where: { id: 'primary' },
    update: {
      email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || undefined,
      tokenType: data.token_type || 'Bearer',
      expiryDate,
      scope: data.scope || SCOPES,
      isConnected: true,
    },
    create: {
      id: 'primary',
      email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      tokenType: data.token_type || 'Bearer',
      expiryDate,
      scope: data.scope || SCOPES,
      isConnected: true,
    },
  });

  console.log('[OutlookAuth] Token exchange successful and connection saved to primary DB record.');
  return { success: true, email };
}

export async function getValidMicrosoftAccessToken(): Promise<string | null> {
  const { clientId, clientSecret, tenantId } = getOutlookConfig();

  if (!clientId || !clientSecret) {
    console.warn('[OutlookAuth] Credentials missing (MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set).');
    return null;
  }

  const conn = await prisma.microsoftConnection.findUnique({ where: { id: 'primary' } });
  if (!conn || !conn.isConnected || !conn.accessToken) {
    return null;
  }

  const isExpired = conn.expiryDate ? new Date(conn.expiryDate).getTime() - 60000 < Date.now() : true;
  if (!isExpired) {
    return conn.accessToken;
  }

  console.log('[OutlookAuth] Access token expired. Attempting refresh token flow...');

  if (!conn.refreshToken) {
    console.warn('[OutlookAuth] Refresh token missing. Setting Outlook connection state to disconnected.');
    await prisma.microsoftConnection.update({
      where: { id: 'primary' },
      data: { isConnected: false },
    });
    return null;
  }

  // Refresh token
  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: conn.scope || SCOPES,
      refresh_token: conn.refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      let sanitizedErr = errText;
      try {
        const errJson = JSON.parse(errText);
        sanitizedErr = errJson.error_description || errJson.error || errText;
      } catch (e) {}
      console.error(`[OutlookAuth] Token refresh failed (HTTP ${res.status}): ${sanitizedErr}. Disconnecting primary record.`);
      await prisma.microsoftConnection.update({
        where: { id: 'primary' },
        data: { isConnected: false },
      });
      return null;
    }

    const data = await res.json();
    const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

    await prisma.microsoftConnection.update({
      where: { id: 'primary' },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || conn.refreshToken,
        expiryDate,
        isConnected: true,
      },
    });

    console.log('[OutlookAuth] Token refreshed successfully.');
    return data.access_token;
  } catch (error: any) {
    console.error('[OutlookAuth] Exception during token refresh:', error.message || error);
    await prisma.microsoftConnection.update({
      where: { id: 'primary' },
      data: { isConnected: false },
    });
    return null;
  }
}

export async function disconnectMicrosoftAccount() {
  console.log('[OutlookAuth] Disconnecting Microsoft Outlook account...');
  await prisma.microsoftConnection.upsert({
    where: { id: 'primary' },
    update: { isConnected: false, accessToken: '', refreshToken: null },
    create: { id: 'primary', accessToken: '', isConnected: false },
  });
}
