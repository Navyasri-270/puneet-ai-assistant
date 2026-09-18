import { NextRequest, NextResponse } from 'next/server';
import { 
  syncTaskToOutlook, 
  syncReminderToOutlook, 
  syncCalendarEventToOutlook, 
  bulkSyncAllToOutlook,
  reconcileOutlookDeletions
} from '@/lib/outlookService';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const result = await reconcileOutlookDeletions();
    return NextResponse.json(result);
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to reconcile Outlook deletions');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const { action, type, id } = body;

    // Handle reconciliation delta sync
    if (action === 'reconcile' || action === 'sync') {
      const result = await reconcileOutlookDeletions();
      return NextResponse.json(result);
    }

    // Handle bulk backfill migration
    if (action === 'bulk') {
      const result = await bulkSyncAllToOutlook();
      return NextResponse.json({
        success: true,
        totalSynced: result.totalSynced,
        totalFailed: result.totalFailed,
        results: result.results
      });
    }

    // Handle single item manual sync / retry
    if (!type || !id) {
      return NextResponse.json({ error: 'Item type (task|reminder|event) and id are required' }, { status: 400 });
    }

    let result: { success: boolean; error?: string; eventId?: string };

    if (type === 'task') {
      result = await syncTaskToOutlook(id);
    } else if (type === 'reminder') {
      result = await syncReminderToOutlook(id);
    } else if (type === 'event') {
      result = await syncCalendarEventToOutlook(id);
    } else {
      return NextResponse.json({ error: `Invalid item type: ${type}` }, { status: 400 });
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        type,
        id,
        eventId: result.eventId,
        message: `Successfully synced ${type} to Outlook Calendar`
      });
    } else {
      return NextResponse.json({
        success: false,
        type,
        id,
        error: result.error || `Failed to sync ${type} to Outlook Calendar`
      }, { status: 400 });
    }
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Internal server error during Outlook sync');
  }
}
