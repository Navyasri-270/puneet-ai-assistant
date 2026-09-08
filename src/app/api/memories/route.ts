import { NextResponse } from 'next/server';
import { getMemories, createMemory } from '@/lib/taskStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    let memories = await getMemories();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
    const category = searchParams.get('category');

    if (category && category !== 'All') {
      memories = memories.filter(m => m.category.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      memories = memories.filter(m => 
        m.key.toLowerCase().includes(search) || 
        m.value.toLowerCase().includes(search) ||
        m.category.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, memories });
  } catch (err: any) {
    console.error("GET /api/memories error:", err);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, value, category } = body;

    if (!key || !value) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }

    const memory = await createMemory({
      key: key.trim(),
      value: value.trim(),
      category: category || 'Preferences'
    });

    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}
