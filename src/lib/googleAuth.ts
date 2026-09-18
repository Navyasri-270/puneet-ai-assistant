import { google } from 'googleapis';
import { prisma } from './db';
import { encryptToken, decryptToken } from './encryption';
import { logger } from './logger';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Creates Google OAuth2 client using environment variables
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth Consent URL
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

/**
 * Exchange Authorization Code for Tokens and store securely server-side with AES-256-GCM encryption
 */
export async function handleOAuthCallback(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch connected user email safely
  let userEmail: string | undefined = undefined;
  try {
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2Api.userinfo.get();
    if (userInfo.data.email) {
      userEmail = userInfo.data.email;
    }
  } catch (err) {
    logger.warn("User email fetch warning:", err);
  }

  // Encrypt tokens before DB insertion
  const encAccessToken = encryptToken(tokens.access_token || '') || '';
  const encRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined;

  // Store token information server-side in database
  const connection = await prisma.googleConnection.upsert({
    where: { id: 'primary' },
    update: {
      email: userEmail || 'puneet@workspace.com',
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenType: tokens.token_type || 'Bearer',
      expiryDate: tokens.expiry_date ? String(tokens.expiry_date) : undefined,
      scope: tokens.scope || SCOPES.join(' '),
      isConnected: true
    },
    create: {
      id: 'primary',
      email: userEmail || 'puneet@workspace.com',
      accessToken: encAccessToken,
      refreshToken: encRefreshToken || undefined,
      tokenType: tokens.token_type || 'Bearer',
      expiryDate: tokens.expiry_date ? String(tokens.expiry_date) : undefined,
      scope: tokens.scope || SCOPES.join(' '),
      isConnected: true
    }
  });

  return connection;
}

/**
 * Get current Google Workspace connection status
 */
export async function getGoogleConnectionStatus(): Promise<{
  isConnected: boolean;
  email?: string;
  hasCredentials: boolean;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const hasCredentials = Boolean(clientId && clientId !== 'your_google_client_id_here' && clientId.length > 5);

  try {
    const conn = await prisma.googleConnection.findUnique({
      where: { id: 'primary' }
    });

    if (conn && conn.isConnected && conn.accessToken) {
      return {
        isConnected: true,
        email: conn.email || undefined,
        hasCredentials
      };
    }
  } catch (err) {
    logger.warn("DB connection status fetch warning:", err);
  }

  return {
    isConnected: false,
    hasCredentials
  };
}

/**
 * Disconnect Google Account
 */
export async function disconnectGoogleAccount(): Promise<boolean> {
  try {
    await prisma.googleConnection.upsert({
      where: { id: 'primary' },
      update: {
        isConnected: false,
        accessToken: '',
        refreshToken: ''
      },
      create: {
        id: 'primary',
        email: '',
        accessToken: '',
        isConnected: false
      }
    });
    return true;
  } catch (err) {
    logger.error("Disconnect error:", err);
    return false;
  }
}

/**
 * Get authenticated Google Calendar API Client with token decryption
 */
export async function getAuthenticatedCalendarClient() {
  const conn = await prisma.googleConnection.findUnique({
    where: { id: 'primary' }
  });

  if (!conn || !conn.isConnected || !conn.accessToken) {
    throw new Error("Google Calendar is not connected");
  }

  const decryptedAccessToken = decryptToken(conn.accessToken);
  const decryptedRefreshToken = conn.refreshToken ? decryptToken(conn.refreshToken) : undefined;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decryptedAccessToken || undefined,
    refresh_token: decryptedRefreshToken || undefined,
    token_type: conn.tokenType || 'Bearer',
    expiry_date: conn.expiryDate ? Number(conn.expiryDate) : undefined
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
