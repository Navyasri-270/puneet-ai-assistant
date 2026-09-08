import { NextResponse } from 'next/server';
import { 
  getCalendarEvents, 
  getUnifiedSchedule, 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  CalendarEventItem
} from '@/lib/calendarService';
import { getGoogleConnectionStatus, getAuthenticatedCalendarClient } from '@/lib/googleAuth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const unified = searchParams.get('unified');

    // Check if Google Workspace Calendar is connected
    let googleEvents: CalendarEventItem[] | null = null;
    const googleStatus = await getGoogleConnectionStatus();

    if (googleStatus.isConnected) {
      try {
        const calendar = await getAuthenticatedCalendarClient();
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          maxResults: 100,
          singleEvents: true,
          orderBy: 'startTime'
        });

        const items = response.data.items || [];
        if (items.length > 0) {
          googleEvents = items.map(evt => {
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
        }
      } catch (gErr) {
        console.warn("Google Calendar API fetch warning, falling back to local DB:", gErr);
      }
    }

    if (unified === 'true') {
      const schedule = await getUnifiedSchedule(date || undefined, googleEvents || undefined);
      return NextResponse.json({ schedule, isGoogleConnected: googleStatus.isConnected });
    }

    const events = googleEvents || await getCalendarEvents();
    return NextResponse.json({ events, isGoogleConnected: googleStatus.isConnected });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data.title || !data.date || !data.startTime) {
      return NextResponse.json({ error: 'Title, Date, and Start Time are required' }, { status: 400 });
    }
    const created = await createCalendarEvent(data);
    return NextResponse.json({ event: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, ...updates } = data;
    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    const updated = await updateCalendarEvent(id, updates);
    return NextResponse.json({ event: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Event ID parameter is required' }, { status: 400 });
    }
    await deleteCalendarEvent(id);
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
