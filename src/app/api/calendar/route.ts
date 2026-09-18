import { NextRequest, NextResponse } from 'next/server';
import { 
  getCalendarEvents, 
  getUnifiedSchedule, 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  CalendarEventItem
} from '@/lib/calendarService';
import { getGoogleConnectionStatus, getAuthenticatedCalendarClient, disconnectGoogleAccount } from '@/lib/googleAuth';
import { fetchOutlookEvents, reconcileOutlookDeletions } from '@/lib/outlookService';
import { prisma } from '@/lib/db';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const unified = searchParams.get('unified');

    let allExternalEvents: CalendarEventItem[] = [];

    // 1. Google Workspace Calendar
    let googleStatus = await getGoogleConnectionStatus();

    if (googleStatus.isConnected) {
      try {
        const calendar = await getAuthenticatedCalendarClient();
        
        const listPromise = calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          maxResults: 100,
          singleEvents: true,
          orderBy: 'startTime'
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Google Calendar fetch timeout")), 2500)
        );

        const response: any = await Promise.race([listPromise, timeoutPromise]);

        const items = response.data?.items || [];
        if (items.length > 0) {
          const gEvents: CalendarEventItem[] = items.map((evt: any) => {
            const startISO = evt.start?.dateTime || (evt.start?.date ? `${evt.start.date}T00:00:00` : new Date().toISOString());
            const endISO = evt.end?.dateTime || (evt.end?.date ? `${evt.end.date}T23:59:59` : startISO);

            return {
              id: evt.id || `g-evt-${Math.random()}`,
              title: evt.summary || 'Google Workspace Meeting',
              description: evt.description || '',
              location: evt.location || 'Google Meet',
              startTime: startISO.includes('T') ? startISO.substring(0, 19) : `${startISO}T09:00:00`,
              endTime: endISO.includes('T') ? endISO.substring(0, 19) : `${endISO}T10:00:00`,
              isAllDay: Boolean(evt.start?.date),
              category: 'Google Meeting',
              createdAt: new Date().toISOString(),
              source: 'google_calendar' as const
            };
          });
          allExternalEvents.push(...gEvents);
        }
      } catch (gErr: any) {
        logger.warn("Google Calendar API fetch warning, falling back:", gErr?.message || gErr);
        const status = gErr?.status || gErr?.code || gErr?.response?.status;
        const msg = String(gErr?.message || '').toLowerCase();
        const isAuthOrScopeError = 
          status === 403 || 
          status === 401 || 
          msg.includes('403') || 
          msg.includes('insufficient') || 
          msg.includes('scope') || 
          msg.includes('invalid_grant') || 
          msg.includes('unauthorized') || 
          msg.includes('invalid_token');

        if (isAuthOrScopeError) {
          try {
            await disconnectGoogleAccount();
            googleStatus.isConnected = false;
          } catch (e) {}
        }
      }
    }

    // 2. Microsoft Outlook Calendar
    let isOutlookConnected = false;
    let outlookError: string | undefined = undefined;
    let outlookDiagnostics: any = null;

    try {
      const msConn = await prisma.microsoftConnection.findUnique({ where: { id: 'primary' } });
      isOutlookConnected = !!(msConn && msConn.isConnected);
      if (isOutlookConnected) {
        const outlookRes = await fetchOutlookEvents(date || undefined, date || undefined);
        outlookDiagnostics = outlookRes.diagnostics || null;
        if (outlookRes.error) {
          outlookError = outlookRes.error;
          logger.warn("[CalendarRoute] Outlook calendar fetch warning:", outlookRes.error);
        }
        if (outlookRes.events && outlookRes.events.length > 0) {
          const mappedOutlook: CalendarEventItem[] = outlookRes.events.map(evt => ({
            id: evt.id,
            title: evt.title,
            description: evt.description,
            location: evt.location,
            startTime: evt.startTime.includes('T') ? evt.startTime.substring(0, 19) : `${evt.startTime}T09:00:00`,
            endTime: evt.endTime.includes('T') ? evt.endTime.substring(0, 19) : `${evt.endTime}T10:00:00`,
            isAllDay: evt.isAllDay,
            category: 'Outlook Meeting',
            createdAt: new Date().toISOString(),
            source: 'outlook' as const
          }));
          allExternalEvents.push(...mappedOutlook);
        }
      }
    } catch (msErr: any) {
      logger.warn("Outlook Calendar fetch error:", msErr?.message || msErr);
    }

    // Combine with local DB events
    if (isOutlookConnected) {
      await reconcileOutlookDeletions().catch((e) => console.warn('[CalendarAPI] Reconciliation warning:', e));
    }

    const localDbEvents = await getCalendarEvents();
    const mergedEvents = [...localDbEvents, ...allExternalEvents];

    if (unified === 'true') {
      const schedule = await getUnifiedSchedule(date || undefined, mergedEvents);
      return NextResponse.json({ 
        schedule, 
        isGoogleConnected: googleStatus.isConnected,
        isOutlookConnected,
        outlookError,
        outlookDiagnostics
      });
    }

    return NextResponse.json({ 
      events: mergedEvents, 
      isGoogleConnected: googleStatus.isConnected,
      isOutlookConnected,
      outlookError,
      outlookDiagnostics
    });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to fetch calendar schedule');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const data = await req.json();
    if (!data.title || !data.date || !data.startTime) {
      return NextResponse.json({ error: 'Title, Date, and Start Time are required' }, { status: 400 });
    }
    const created = await createCalendarEvent(data);
    return NextResponse.json({ event: created });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to create calendar event');
  }
}

export async function PUT(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const data = await req.json();
    const { id, ...updates } = data;
    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    const updated = await updateCalendarEvent(id, updates);
    return NextResponse.json({ event: updated });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to update calendar event');
  }
}

export async function DELETE(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Event ID parameter is required' }, { status: 400 });
    }
    const result = await deleteCalendarEvent(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete calendar event' }, { status: 400 });
    }
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to delete calendar event');
  }
}
