import { NextResponse } from 'next/server';
import { 
  syncTaskToOutlook, 
  syncReminderToOutlook, 
  syncCalendarEventToOutlook, 
  bulkSyncAllToOutlook 
} from '@/lib/outlookService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, type, id } = body;

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
    console.error("POST /api/outlook/sync error:", err);
    return NextResponse.json({ error: err.message || 'Internal server error during Outlook sync' }, { status: 500 });
  }
}
