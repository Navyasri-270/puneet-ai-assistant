import { getValidMicrosoftAccessToken } from './outlookAuth';

export interface OutlookEventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  category: string;
  source: 'outlook';
  organizer?: string;
  attendees?: string[];
}

export interface OutlookDiagnostics {
  startDateRequested: string;
  endDateRequested: string;
  httpStatus: number;
  eventsCount: number;
  endpoint: string;
  hasNextLink: boolean;
  canReadDefaultCalendar: boolean;
}

function parseGraphDateTime(dtObj?: { dateTime?: string; timeZone?: string }): string {
  if (!dtObj || !dtObj.dateTime) return new Date().toISOString();
  let dtStr = dtObj.dateTime;
  // If Microsoft Graph returns ISO string without offset or trailing Z, append Z for UTC
  if (!dtStr.endsWith('Z') && !dtStr.includes('+') && !dtStr.includes('-')) {
    dtStr += 'Z';
  }
  try {
    return new Date(dtStr).toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

export async function fetchOutlookEvents(startDate?: string, endDate?: string): Promise<{
  events: OutlookEventItem[];
  error?: string;
  diagnostics?: OutlookDiagnostics;
}> {
  const token = await getValidMicrosoftAccessToken();
  if (!token) {
    return { events: [], error: 'Outlook account is not connected or token is invalid.' };
  }

  // Calculate full day boundaries for date range
  let startIso: string;
  let endIso: string;

  if (startDate) {
    const sDate = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
    startIso = new Date(sDate).toISOString();
  } else {
    // Default: 7 days prior to today
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    startIso = d.toISOString();
  }

  if (endDate) {
    const eDate = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
    endIso = new Date(eDate).toISOString();
  } else {
    // Default: 30 days from today
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(23, 59, 59, 999);
    endIso = d.toISOString();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const endpointUrl = 'https://graph.microsoft.com/v1.0/me/calendarView';

  try {
    console.log(`[OutlookService] Fetching Outlook calendarView from ${startIso} to ${endIso}...`);

    let graphUrl: string | null = `${endpointUrl}?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}&$select=id,subject,bodyPreview,start,end,location,isAllDay,organizer,attendees&$top=100`;

    const allEventsData: any[] = [];
    let hasNextLink = false;
    let httpStatus = 200;

    while (graphUrl) {
      const res: Response = await fetch(graphUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        signal: controller.signal,
      });

      httpStatus = res.status;

      if (!res.ok) {
        clearTimeout(timeoutId);
        const errText = await res.text();
        let sanitizedMsg = `HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          sanitizedMsg = errJson.error?.message || errJson.message || sanitizedMsg;
        } catch (e) {}
        console.warn(`[OutlookService] Microsoft Graph API returned error (${res.status}): ${sanitizedMsg}`);
        return {
          events: [],
          error: `Microsoft Graph API error (${res.status}): ${sanitizedMsg}`,
          diagnostics: {
            startDateRequested: startIso,
            endDateRequested: endIso,
            httpStatus,
            eventsCount: 0,
            endpoint: endpointUrl,
            hasNextLink: false,
            canReadDefaultCalendar: false,
          },
        };
      }

      const data = await res.json();
      if (data.value && Array.isArray(data.value)) {
        allEventsData.push(...data.value);
      }

      if (data['@odata.nextLink']) {
        hasNextLink = true;
        graphUrl = data['@odata.nextLink'];
      } else {
        graphUrl = null;
      }
    }

    clearTimeout(timeoutId);

    const events: OutlookEventItem[] = allEventsData.map((item: any) => ({
      id: item.id,
      title: item.subject || 'Untitled Meeting',
      description: item.bodyPreview || '',
      location: item.location?.displayName || '',
      startTime: parseGraphDateTime(item.start),
      endTime: parseGraphDateTime(item.end),
      isAllDay: !!item.isAllDay,
      category: 'Outlook Meeting',
      source: 'outlook',
      organizer: item.organizer?.emailAddress?.name || item.organizer?.emailAddress?.address,
      attendees: item.attendees ? item.attendees.map((a: any) => a.emailAddress?.name || a.emailAddress?.address).filter(Boolean) : [],
    }));

    const diagnostics: OutlookDiagnostics = {
      startDateRequested: startIso,
      endDateRequested: endIso,
      httpStatus,
      eventsCount: events.length,
      endpoint: endpointUrl,
      hasNextLink,
      canReadDefaultCalendar: true,
    };

    console.log(`[OutlookService] Successfully processed ${events.length} Outlook calendar events.`);
    return { events, diagnostics };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const errMsg = isTimeout ? 'Microsoft Graph API request timed out.' : (err.message || 'Failed to fetch Outlook events');
    console.error('[OutlookService] Error fetching Outlook calendar events:', errMsg);
    return {
      events: [],
      error: errMsg,
      diagnostics: {
        startDateRequested: startIso,
        endDateRequested: endIso,
        httpStatus: 500,
        eventsCount: 0,
        endpoint: endpointUrl,
        hasNextLink: false,
        canReadDefaultCalendar: false,
      },
    };
  }
}

export async function createOutlookEvent(params: {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const token = await getValidMicrosoftAccessToken();
  if (!token) {
    return { success: false, error: 'Outlook is not connected' };
  }

  try {
    const payload = {
      subject: params.title,
      body: {
        contentType: 'text',
        content: params.description || '',
      },
      start: {
        dateTime: new Date(params.startTime).toISOString().replace('Z', ''),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(params.endTime).toISOString().replace('Z', ''),
        timeZone: 'UTC',
      },
      location: {
        displayName: params.location || '',
      },
    };

    console.log('[OutlookService] Creating Outlook calendar event via Microsoft Graph...');

    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      let sanitizedMsg = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        sanitizedMsg = errJson.error?.message || sanitizedMsg;
      } catch (e) {}
      console.error(`[OutlookService] Event creation failed (${res.status}): ${sanitizedMsg}`);
      return { success: false, error: `Microsoft Graph API error (${res.status}): ${sanitizedMsg}` };
    }

    const data = await res.json();
    console.log(`[OutlookService] Outlook event created successfully. Event ID: ${data.id}`);
    return { success: true, eventId: data.id };
  } catch (error: any) {
    console.error('[OutlookService] Exception creating Outlook event:', error.message || error);
    return { success: false, error: error.message || 'Failed to create Outlook event' };
  }
}
