import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rules } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allRules = await db.select().from(rules).orderBy(rules.createdAt);
    return NextResponse.json({ data: allRules });
  } catch (error) {
    return NextResponse.json({ error: '获取规则列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, fileType, config } = body;

    if (!name || !fileType || !config) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const [newRule] = await db.insert(rules).values({
      name,
      description: description || '',
      fileType,
      config,
    }).returning();

    return NextResponse.json({ data: newRule }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '创建规则失败' }, { status: 500 });
  }
}
