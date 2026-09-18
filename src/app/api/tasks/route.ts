import { NextRequest, NextResponse } from 'next/server';
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const tasks = await getTasks();
    return NextResponse.json({ tasks });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to fetch tasks');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const data = await req.json();
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      return NextResponse.json({ error: 'Valid task title is required' }, { status: 400 });
    }
    const created = await createTask(data);
    return NextResponse.json({ task: created }, { status: 201 });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to create task');
  }
}

export async function PUT(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const data = await req.json();
    const { id, ...updates } = data;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid Task ID is required' }, { status: 400 });
    }
    const updated = await updateTask(id, updates);
    return NextResponse.json({ task: updated });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to update task');
  }
}

export async function DELETE(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Task ID parameter is required' }, { status: 400 });
    }
    const result = await deleteTask(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete task' }, { status: 400 });
    }
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to delete task');
  }
}
