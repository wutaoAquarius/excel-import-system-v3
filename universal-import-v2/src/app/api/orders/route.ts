import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const keyword = searchParams.get('keyword') || '';

    const offset = (page - 1) * pageSize;

    let whereClause;
    if (keyword) {
      whereClause = sql`${orders.externalCode} ILIKE ${'%' + keyword + '%'} OR ${orders.receiverName} ILIKE ${'%' + keyword + '%'}`;
    }

    const data = whereClause
      ? await db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt)).limit(pageSize).offset(offset)
      : await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(pageSize).offset(offset);

    // 总数
    const countResult = whereClause
      ? await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(whereClause)
      : await db.select({ count: sql<number>`count(*)::int` }).from(orders);

    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      data: { records: data, total, page, pageSize }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
