import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { and, desc, gte, lte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const keyword = searchParams.get('keyword') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const offset = (page - 1) * pageSize;

    // 构建所有过滤条件
    const conditions = [];
    if (keyword) {
      conditions.push(sql`${orders.externalCode} ILIKE ${'%' + keyword + '%'} OR ${orders.receiverName} ILIKE ${'%' + keyword + '%'}`);
    }
    if (startDate) {
      conditions.push(gte(orders.createdAt, new Date(startDate)));
    }
    if (endDate) {
      // endDate加一天，实现当天结束时包含全天
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      conditions.push(lte(orders.createdAt, end));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
