import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: any = {};
    if (category && category !== 'All') {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: [
        { pinned: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, category, pinned, tags } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Note title is required' },
        { status: 400 }
      );
    }

    const note = await prisma.note.create({
      data: {
        title: title.trim(),
        content: content || '',
        category: category || 'General',
        pinned: Boolean(pinned),
        tags: tags || '',
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create note' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, content, category, pinned, tags } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const updatedData: any = {};
    if (title !== undefined) updatedData.title = title.trim();
    if (content !== undefined) updatedData.content = content;
    if (category !== undefined) updatedData.category = category;
    if (pinned !== undefined) updatedData.pinned = Boolean(pinned);
    if (tags !== undefined) updatedData.tags = tags;

    const note = await prisma.note.update({
      where: { id },
      data: updatedData,
    });

    return NextResponse.json({ note });
  } catch (error: any) {
    console.error('Failed to update note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update note' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Failed to delete note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete note' },
      { status: 500 }
    );
  }
}
