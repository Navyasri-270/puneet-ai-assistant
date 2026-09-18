import { NextRequest, NextResponse } from 'next/server';
import { getMemories, createMemory } from '@/lib/taskStore';
import { validateExecutiveAuth, sanitizeErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

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
    return sanitizeErrorResponse(err, 'Failed to fetch memories');
  }
}

export async function POST(req: NextRequest) {
  const auth = validateExecutiveAuth(req);
  if (!auth.authorized && auth.response) return auth.response;

  try {
    const body = await req.json();
    const { key, value, category } = body;

    if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
      return NextResponse.json({ error: 'Valid Key and Value string fields are required' }, { status: 400 });
    }

    const memory = await createMemory({
      key: key.trim(),
      value: value.trim(),
      category: category || 'Preferences'
    });

    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (err: any) {
    return sanitizeErrorResponse(err, 'Failed to create memory');
  }
}
