import { NextResponse } from 'next/server';
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/taskStore';

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const created = await createTask(data);
    return NextResponse.json({ task: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, ...updates } = data;
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    const updated = await updateTask(id, updates);
    return NextResponse.json({ task: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Task ID parameter is required' }, { status: 400 });
    }
    await deleteTask(id);
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
