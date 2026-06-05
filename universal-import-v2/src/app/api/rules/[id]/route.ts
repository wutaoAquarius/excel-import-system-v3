import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rules } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [rule] = await db.select().from(rules).where(eq(rules.id, id));
    if (!rule) return NextResponse.json({ error: '规则不存在' }, { status: 404 });
    return NextResponse.json({ data: rule });
  } catch (error) {
    return NextResponse.json({ error: '获取规则失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, description, fileType, config } = body;

    const [updated] = await db.update(rules)
      .set({ name, description, fileType, config, updatedAt: new Date() })
      .where(eq(rules.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: '规则不存在' }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json({ error: '更新规则失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await db.delete(rules).where(eq(rules.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除规则失败' }, { status: 500 });
  }
}
