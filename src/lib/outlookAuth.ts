import { NextRequest } from 'next/server';
import { prisma } from './db';
import { encryptToken, decryptToken } from './encryption';
import { logger } from './logger';

const SCOPES = ['openid', 'profile', 'User.Read', 'Calendars.Read', 'offline_access'].join(' ');

/**
 * Resolves the shared Microsoft Outlook OAuth Redirect URI consistently.
 * Prioritizes:
 * 1. process.env.MICROSOFT_REDIRECT_URI
 * 2. process.env.NEXT_PUBLIC_APP_URL
 * 3. Stable production domain fallback (https://puneet-ai-assistant.vercel.app/api/auth/outlook/callback)
 * 4. Development mode fallback (http://localhost:3000/api/auth/outlook/callback)
 */
export function getOutlookRedirectUri(req?: NextRequest): string {
  let redirectUri = (process.env.MICROSOFT_REDIRECT_URI || '').trim();

  if (!redirectUri && process.env.NEXT_PUBLIC_APP_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '');
    redirectUri = `${baseUrl}/api/auth/outlook/callback`;
  }

  // If in local development, use localhost
  if (!redirectUri && process.env.NODE_ENV === 'development') {
    redirectUri = 'http://localhost:3000/api/auth/outlook/callback';
  }

  // Stable production domain default fallback
  if (!redirectUri) {
    redirectUri = 'https://puneet-ai-assistant.vercel.app/api/auth/outlook/callback';
  }

  // Safe logging only: Never log client secrets or tokens
  logger.info(`[OutlookAuth] Resolved redirect_uri: "${redirectUri}" (MICROSOFT_REDIRECT_URI configured: ${!!process.env.MICROSOFT_REDIRECT_URI})`);

  return redirectUri;
}

export function getOutlookConfig(req?: NextRequest, customRedirectUri?: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = customRedirectUri || getOutlookRedirectUri(req);

  return { clientId, clientSecret, tenantId, redirectUri, scopes: SCOPES };
}

export function getMicrosoftAuthUrl(state?: string, req?: NextRequest): string {
  const { clientId, tenantId, redirectUri } = getOutlookConfig(req);

  if (!clientId) {
    logger.error('[OutlookAuth] Error: MICROSOFT_CLIENT_ID is missing from environment variables.');
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

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, customRedirectUri?: string, req?: NextRequest) {
  const { clientId, clientSecret, tenantId, redirectUri } = getOutlookConfig(req, customRedirectUri);

  if (!clientId || !clientSecret) {
    logger.error('[OutlookAuth] Error: Credentials missing during code exchange.');
    throw new Error('MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET is not configured in environment variables.');
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
    let sanitizedErr = 'Failed to exchange authorization code';
    try {
      const errJson = JSON.parse(errText);
      sanitizedErr = errJson.error_description || errJson.error || sanitizedErr;
    } catch (e) {}
    logger.error(`[OutlookAuth] Token exchange failed with HTTP status ${res.status}`);
    throw new Error(`Failed to exchange authorization code: ${sanitizedErr}`);
  }

  const data = await res.json();
  const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  // Encrypt tokens before storing in database
  const encAccessToken = encryptToken(data.access_token) || '';
  const encRefreshToken = data.refresh_token ? encryptToken(data.refresh_token) : null;

  // Fetch user profile email safely
  let email: string | null = null;
  try {
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      email = userData.mail || userData.userPrincipalName || null;
    }
  } catch (err: any) {
    logger.error('[OutlookAuth] Failed to fetch Microsoft user profile:', err.message || err);
  }

  await prisma.microsoftConnection.upsert({
    where: { id: 'primary' },
    update: {
      email,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenType: data.token_type || 'Bearer',
      expiryDate,
      scope: data.scope || SCOPES,
      isConnected: true,
    },
    create: {
      id: 'primary',
      email,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenType: data.token_type || 'Bearer',
      expiryDate,
      scope: data.scope || SCOPES,
      isConnected: true,
    },
  });

  logger.info('[OutlookAuth] Token exchange successful and connection saved securely to primary DB record.');
  return { success: true, email };
}

export async function getValidMicrosoftAccessToken(): Promise<string | null> {
  const { clientId, clientSecret, tenantId } = getOutlookConfig();

  if (!clientId || !clientSecret) {
    logger.warn('[OutlookAuth] Credentials missing (MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set).');
    return null;
  }

  const conn = await prisma.microsoftConnection.findUnique({ where: { id: 'primary' } });
  if (!conn || !conn.isConnected || !conn.accessToken) {
    return null;
  }

  const decryptedAccessToken = decryptToken(conn.accessToken);
  const decryptedRefreshToken = conn.refreshToken ? decryptToken(conn.refreshToken) : null;

  const isExpired = conn.expiryDate ? new Date(conn.expiryDate).getTime() - 60000 < Date.now() : true;
  if (!isExpired && decryptedAccessToken) {
    return decryptedAccessToken;
  }

  logger.info('[OutlookAuth] Access token expired or unencrypted. Attempting refresh token flow...');

  if (!decryptedRefreshToken) {
    logger.warn('[OutlookAuth] Refresh token missing. Setting Outlook connection state to disconnected.');
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
      refresh_token: decryptedRefreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      logger.error(`[OutlookAuth] Token refresh failed (HTTP ${res.status}). Disconnecting primary record.`);
      await prisma.microsoftConnection.update({
        where: { id: 'primary' },
        data: { isConnected: false },
      });
      return null;
    }

    const data = await res.json();
    const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

    const encNewAccessToken = encryptToken(data.access_token) || '';
    const encNewRefreshToken = data.refresh_token ? encryptToken(data.refresh_token) : conn.refreshToken;

    await prisma.microsoftConnection.update({
      where: { id: 'primary' },
      data: {
        accessToken: encNewAccessToken,
        refreshToken: encNewRefreshToken,
        expiryDate,
        isConnected: true,
      },
    });

    logger.info('[OutlookAuth] Token refreshed successfully.');
    return data.access_token;
  } catch (error: any) {
    logger.error('[OutlookAuth] Exception during token refresh:', error.message || error);
    await prisma.microsoftConnection.update({
      where: { id: 'primary' },
      data: { isConnected: false },
    });
    return null;
  }
}

export async function disconnectMicrosoftAccount() {
  logger.info('[OutlookAuth] Disconnecting Microsoft Outlook account...');
  await prisma.microsoftConnection.upsert({
    where: { id: 'primary' },
    update: { isConnected: false, accessToken: '', refreshToken: null },
    create: { id: 'primary', accessToken: '', isConnected: false },
  });
}
