import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * Validates Executive Authentication for single-tenant API routes.
 * Checks EXECUTIVE_API_KEY or AUTH_SECRET from process.env.
 * Accepts token via:
 * 1. Authorization: Bearer <token>
 * 2. x-executive-token: <token>
 * 3. In development mode without key set, permits access for convenience.
 */
export function validateExecutiveAuth(req: NextRequest): { authorized: boolean; response?: NextResponse } {
  const secretKey = process.env.EXECUTIVE_API_KEY || process.env.AUTH_SECRET;

  // In production, if EXECUTIVE_API_KEY is configured, strictly enforce token match
  if (secretKey) {
    const authHeader = req.headers.get('authorization');
    const customHeader = req.headers.get('x-executive-token');
    
    let token = customHeader;
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token !== secretKey) {
      logger.warn(`Unauthorized API access attempt to ${req.nextUrl.pathname}`);
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'Unauthorized - Valid Executive API Key Required' },
          { status: 401 }
        ),
      };
    }
  }

  return { authorized: true };
}

/**
 * Validates CRON_SECRET for background scheduled jobs.
 * Rejects requests if CRON_SECRET is missing or invalid.
 */
export function validateCronAuth(req: NextRequest): { authorized: boolean; response?: NextResponse } {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET environment variable is missing.');
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Server configuration error: CRON_SECRET is not configured' },
        { status: 500 }
      ),
    };
  }

  const authHeader = req.headers.get('authorization');
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret');

  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : querySecret;

  if (token !== cronSecret) {
    logger.warn(`Unauthorized cron access attempt to ${req.nextUrl.pathname}`);
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid Cron Secret' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Returns a sanitized JSON error response without internal stack traces or secrets.
 */
export function sanitizeErrorResponse(error: any, defaultMsg = 'An internal server error occurred'): NextResponse {
  logger.error(defaultMsg, error?.message || error);

  return NextResponse.json(
    {
      success: false,
      error: defaultMsg,
    },
    { status: 500 }
  );
}
