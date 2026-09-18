import { getValidMicrosoftAccessToken } from './outlookAuth';
import { prisma } from './db';

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

export interface GraphEventParams {
  title: string;
  description?: string;
  startTime: string; // ISO string or YYYY-MM-DDTHH:MM:SS
  endTime: string;   // ISO string or YYYY-MM-DDTHH:MM:SS
  isAllDay?: boolean;
  location?: string;
  isReminderOn?: boolean;
  reminderMinutesBeforeStart?: number;
}

function parseGraphDateTime(dtObj?: { dateTime?: string; timeZone?: string }): string {
  if (!dtObj || !dtObj.dateTime) return new Date().toISOString();
  let dtStr = dtObj.dateTime;
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

  let startIso: string;
  let endIso: string;

  if (startDate) {
    const sDate = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
    startIso = new Date(sDate).toISOString();
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    startIso = d.toISOString();
  }

  if (endDate) {
    const eDate = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
    endIso = new Date(eDate).toISOString();
  } else {
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

/**
 * Format payload for Microsoft Graph POST /me/events and PATCH /me/events/{id}
 */
function buildGraphEventPayload(params: GraphEventParams) {
  const isAllDay = !!params.isAllDay;
  let startDateTimeStr: string;
  let endDateTimeStr: string;

  if (isAllDay) {
    const startDatePart = params.startTime.split('T')[0];
    const endDatePart = params.endTime ? params.endTime.split('T')[0] : startDatePart;
    startDateTimeStr = `${startDatePart}T00:00:00`;
    endDateTimeStr = `${endDatePart}T23:59:59`;
  } else {
    startDateTimeStr = new Date(params.startTime).toISOString().replace('Z', '');
    endDateTimeStr = new Date(params.endTime).toISOString().replace('Z', '');
  }

  return {
    subject: params.title,
    body: {
      contentType: 'text',
      content: params.description || '',
    },
    start: {
      dateTime: startDateTimeStr,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDateTimeStr,
      timeZone: 'UTC',
    },
    isAllDay,
    location: {
      displayName: params.location || '',
    },
    isReminderOn: params.isReminderOn !== undefined ? params.isReminderOn : true,
    reminderMinutesBeforeStart: params.reminderMinutesBeforeStart || 15,
  };
}

/**
 * Create a new Outlook Calendar event via POST https://graph.microsoft.com/v1.0/me/events
 */
export async function createOutlookEvent(params: GraphEventParams): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const token = await getValidMicrosoftAccessToken();
  if (!token) {
    return { success: false, error: 'Outlook account is not connected' };
  }

  try {
    const payload = buildGraphEventPayload(params);
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

/**
 * Update an existing Outlook Calendar event via PATCH https://graph.microsoft.com/v1.0/me/events/{eventId}
 */
export async function updateOutlookEvent(eventId: string, params: GraphEventParams): Promise<{ success: boolean; error?: string; status?: number }> {
  const token = await getValidMicrosoftAccessToken();
  if (!token) {
    return { success: false, error: 'Outlook account is not connected' };
  }

  try {
    const payload = buildGraphEventPayload(params);
    console.log(`[OutlookService] Updating Outlook calendar event ${eventId} via Microsoft Graph...`);

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
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
      console.error(`[OutlookService] Event update failed (${res.status}): ${sanitizedMsg}`);
      return { success: false, error: `Microsoft Graph API error (${res.status}): ${sanitizedMsg}`, status: res.status };
    }

    console.log(`[OutlookService] Outlook event ${eventId} updated successfully.`);
    return { success: true };
  } catch (error: any) {
    console.error('[OutlookService] Exception updating Outlook event:', error.message || error);
    return { success: false, error: error.message || 'Failed to update Outlook event' };
  }
}

/**
 * Delete an Outlook Calendar event via DELETE https://graph.microsoft.com/v1.0/me/events/{eventId}
 */
export async function deleteOutlookEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  const token = await getValidMicrosoftAccessToken();
  if (!token) {
    return { success: false, error: 'Outlook account is not connected' };
  }

  try {
    console.log(`[OutlookService] Deleting Outlook calendar event ${eventId} via Microsoft Graph...`);

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      let sanitizedMsg = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        sanitizedMsg = errJson.error?.message || sanitizedMsg;
      } catch (e) {}
      console.error(`[OutlookService] Event deletion failed (${res.status}): ${sanitizedMsg}`);
      return { success: false, error: `Microsoft Graph API error (${res.status}): ${sanitizedMsg}` };
    }

    console.log(`[OutlookService] Outlook event ${eventId} deleted successfully (or already absent).`);
    return { success: true };
  } catch (error: any) {
    console.error('[OutlookService] Exception deleting Outlook event:', error.message || error);
    return { success: false, error: error.message || 'Failed to delete Outlook event' };
  }
}

/**
 * Synchronize a single Task item to Outlook Calendar
 */
export async function syncTaskToOutlook(taskId: string): Promise<{ success: boolean; error?: string; eventId?: string }> {
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, error: 'Task not found' };

    const token = await getValidMicrosoftAccessToken();
    if (!token) {
      await prisma.task.update({
        where: { id: taskId },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: 'Outlook account is not connected' }
      });
      return { success: false, error: 'Outlook account is not connected' };
    }

    const isAllDay = !task.dueTime || task.dueTime.trim() === '';
    const dateStr = task.dueDate || new Date().toISOString().split('T')[0];

    let startIso: string;
    let endIso: string;

    if (isAllDay) {
      startIso = `${dateStr}T00:00:00.000Z`;
      endIso = `${dateStr}T23:59:59.999Z`;
    } else {
      const startDt = parseDateAndTimeString(dateStr, task.dueTime!);
      const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);
      startIso = startDt.toISOString();
      endIso = endDt.toISOString();
    }

    const params: GraphEventParams = {
      title: task.title,
      description: `[Task Priority: ${task.priority}] [Category: ${task.category}]\n${task.description || ''}\n${task.notes ? 'Notes: ' + task.notes : ''}`.trim(),
      startTime: startIso,
      endTime: endIso,
      isAllDay,
      isReminderOn: task.notificationEnabled !== false,
      reminderMinutesBeforeStart: task.notificationBefore || 15
    };

    if (task.outlookEventId) {
      const patchRes = await updateOutlookEvent(task.outlookEventId, params);
      if (patchRes.success) {
        await prisma.task.update({
          where: { id: taskId },
          data: { outlookSyncStatus: 'Synced', outlookSyncError: null }
        });
        return { success: true, eventId: task.outlookEventId };
      } else if (patchRes.status === 404) {
        console.log(`[OutlookService] Event ${task.outlookEventId} not found in Outlook, creating new...`);
      } else {
        await prisma.task.update({
          where: { id: taskId },
          data: { outlookSyncStatus: 'Failed', outlookSyncError: patchRes.error }
        });
        return { success: false, error: patchRes.error };
      }
    }

    const postRes = await createOutlookEvent(params);
    if (postRes.success && postRes.eventId) {
      await prisma.task.update({
        where: { id: taskId },
        data: { outlookEventId: postRes.eventId, outlookSyncStatus: 'Synced', outlookSyncError: null }
      });
      return { success: true, eventId: postRes.eventId };
    } else {
      await prisma.task.update({
        where: { id: taskId },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: postRes.error }
      });
      return { success: false, error: postRes.error };
    }
  } catch (err: any) {
    console.error(`[OutlookService] syncTaskToOutlook exception for ${taskId}:`, err);
    return { success: false, error: err.message || 'Exception syncing task to Outlook' };
  }
}

/**
 * Synchronize a single Reminder item to Outlook Calendar
 */
export async function syncReminderToOutlook(reminderId: string): Promise<{ success: boolean; error?: string; eventId?: string }> {
  try {
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { task: true }
    });
    if (!reminder) return { success: false, error: 'Reminder not found' };

    const token = await getValidMicrosoftAccessToken();
    if (!token) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: 'Outlook account is not connected' }
      });
      return { success: false, error: 'Outlook account is not connected' };
    }

    const startDt = reminder.reminderTime;
    const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);

    const params: GraphEventParams = {
      title: reminder.title,
      description: reminder.task ? `Linked Task: ${reminder.task.title}` : 'Executive Reminder',
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      isAllDay: false,
      isReminderOn: reminder.notificationEnabled !== false,
      reminderMinutesBeforeStart: reminder.notificationBefore || 15
    };

    if (reminder.outlookEventId) {
      const patchRes = await updateOutlookEvent(reminder.outlookEventId, params);
      if (patchRes.success) {
        await prisma.reminder.update({
          where: { id: reminderId },
          data: { outlookSyncStatus: 'Synced', outlookSyncError: null }
        });
        return { success: true, eventId: reminder.outlookEventId };
      } else if (patchRes.status === 404) {
        console.log(`[OutlookService] Event ${reminder.outlookEventId} not found in Outlook, creating new...`);
      } else {
        await prisma.reminder.update({
          where: { id: reminderId },
          data: { outlookSyncStatus: 'Failed', outlookSyncError: patchRes.error }
        });
        return { success: false, error: patchRes.error };
      }
    }

    const postRes = await createOutlookEvent(params);
    if (postRes.success && postRes.eventId) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { outlookEventId: postRes.eventId, outlookSyncStatus: 'Synced', outlookSyncError: null }
      });
      return { success: true, eventId: postRes.eventId };
    } else {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: postRes.error }
      });
      return { success: false, error: postRes.error };
    }
  } catch (err: any) {
    console.error(`[OutlookService] syncReminderToOutlook exception for ${reminderId}:`, err);
    return { success: false, error: err.message || 'Exception syncing reminder to Outlook' };
  }
}

/**
 * Synchronize a single CalendarEvent item to Outlook Calendar
 */
export async function syncCalendarEventToOutlook(eventId: string): Promise<{ success: boolean; error?: string; eventId?: string }> {
  try {
    const evt = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!evt) return { success: false, error: 'Calendar event not found' };

    const token = await getValidMicrosoftAccessToken();
    if (!token) {
      await prisma.calendarEvent.update({
        where: { id: eventId },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: 'Outlook account is not connected' }
      });
      return { success: false, error: 'Outlook account is not connected' };
    }

    const params: GraphEventParams = {
      title: evt.title,
      description: evt.description || '',
      location: evt.location || '',
      startTime: evt.startTime.toISOString(),
      endTime: evt.endTime.toISOString(),
      isAllDay: evt.isAllDay,
      isReminderOn: true,
      reminderMinutesBeforeStart: 15
    };

    if (evt.outlookEventId) {
      const patchRes = await updateOutlookEvent(evt.outlookEventId, params);
      if (patchRes.success) {
        await prisma.calendarEvent.update({
          where: { id: eventId },
          data: { outlookSyncStatus: 'Synced', outlookSyncError: null }
        });
        return { success: true, eventId: evt.outlookEventId };
      } else if (patchRes.status === 404) {
        console.log(`[OutlookService] Event ${evt.outlookEventId} not found in Outlook, creating new...`);
      } else {
        await prisma.calendarEvent.update({
          where: { id: eventId },
          data: { outlookSyncStatus: 'Failed', outlookSyncError: patchRes.error }
        });
        return { success: false, error: patchRes.error };
      }
    }

    const postRes = await createOutlookEvent(params);
    if (postRes.success && postRes.eventId) {
      await prisma.calendarEvent.update({
        where: { id: eventId },
        data: { outlookEventId: postRes.eventId, outlookSyncStatus: 'Synced', outlookSyncError: null }
      });
      return { success: true, eventId: postRes.eventId };
    } else {
      await prisma.calendarEvent.update({
        where: { id: eventId },
        data: { outlookSyncStatus: 'Failed', outlookSyncError: postRes.error }
      });
      return { success: false, error: postRes.error };
    }
  } catch (err: any) {
    console.error(`[OutlookService] syncCalendarEventToOutlook exception for ${eventId}:`, err);
    return { success: false, error: err.message || 'Exception syncing calendar event to Outlook' };
  }
}

/**
 * Bulk backfill migration: Sync ALL existing unsynced or failed tasks, reminders, and calendar events to Outlook Calendar
 */
export async function bulkSyncAllToOutlook(): Promise<{
  totalSynced: number;
  totalFailed: number;
  results: { type: string; id: string; title: string; status: string; error?: string }[];
}> {
  const token = await getValidMicrosoftAccessToken();
  if (!token) {
    return {
      totalSynced: 0,
      totalFailed: 0,
      results: [{ type: 'system', id: 'auth', title: 'Outlook Account', status: 'Failed', error: 'Outlook account is not connected' }]
    };
  }

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { outlookSyncStatus: { not: 'Synced' } },
        { outlookSyncStatus: null },
        { outlookEventId: null }
      ]
    }
  });

  const reminders = await prisma.reminder.findMany({
    where: {
      OR: [
        { outlookSyncStatus: { not: 'Synced' } },
        { outlookSyncStatus: null },
        { outlookEventId: null }
      ]
    }
  });

  const events = await prisma.calendarEvent.findMany({
    where: {
      OR: [
        { outlookSyncStatus: { not: 'Synced' } },
        { outlookSyncStatus: null },
        { outlookEventId: null }
      ]
    }
  });

  let totalSynced = 0;
  let totalFailed = 0;
  const results: { type: string; id: string; title: string; status: string; error?: string }[] = [];

  for (const t of tasks) {
    const res = await syncTaskToOutlook(t.id);
    if (res.success) {
      totalSynced++;
      results.push({ type: 'task', id: t.id, title: t.title, status: 'Synced' });
    } else {
      totalFailed++;
      results.push({ type: 'task', id: t.id, title: t.title, status: 'Failed', error: res.error });
    }
  }

  for (const r of reminders) {
    const res = await syncReminderToOutlook(r.id);
    if (res.success) {
      totalSynced++;
      results.push({ type: 'reminder', id: r.id, title: r.title, status: 'Synced' });
    } else {
      totalFailed++;
      results.push({ type: 'reminder', id: r.id, title: r.title, status: 'Failed', error: res.error });
    }
  }

  for (const e of events) {
    const res = await syncCalendarEventToOutlook(e.id);
    if (res.success) {
      totalSynced++;
      results.push({ type: 'event', id: e.id, title: e.title, status: 'Synced' });
    } else {
      totalFailed++;
      results.push({ type: 'event', id: e.id, title: e.title, status: 'Failed', error: res.error });
    }
  }

  return { totalSynced, totalFailed, results };
}

/**
 * Utility function to parse date string (YYYY-MM-DD) and time string (e.g. "10:00 AM" or "15:30") into a Date object
 */
function parseDateAndTimeString(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 10;
  let minutes = 0;

  const match = timeStr.trim().match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    hours = h;
    minutes = m;
  }

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
}
