import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, importBatches } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { WaybillRecord } from '@/lib/rules';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records, fileName, ruleId } = body as {
      records: WaybillRecord[];
      fileName: string;
      ruleId?: string;
    };

    if (!records || records.length === 0) {
      return NextResponse.json({ error: '无数据可提交' }, { status: 400 });
    }

    // 批量查询数据库中已存在的externalCode
    const externalCodes = records
      .map((r) => r.externalCode)
      .filter((code): code is string => Boolean(code));

    let existingCodes = new Set<string>();
    if (externalCodes.length > 0) {
      const existing = await db
        .select({ externalCode: orders.externalCode })
        .from(orders)
        .where(inArray(orders.externalCode, externalCodes));
      existingCodes = new Set(existing.map((r) => r.externalCode).filter((c): c is string => c !== null));
    }

    // 创建批次
    const [batch] = await db.insert(importBatches).values({
      fileName,
      ruleId: ruleId || null,
      totalCount: records.length,
      status: 'processing',
    }).returning();

    // 批量插入运单
    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;

    for (const record of records) {
      // 跳过已存在的externalCode
      if (record.externalCode && existingCodes.has(record.externalCode)) {
        duplicateCount++;
        failCount++;
        continue;
      }
      try {
        await db.insert(orders).values({
          externalCode: record.externalCode || null,
          storeName: record.storeName || null,
          receiverName: record.receiverName || null,
          receiverPhone: record.receiverPhone || null,
          receiverAddress: record.receiverAddress || null,
          skuCode: record.skuCode,
          skuName: record.skuName,
          skuQuantity: record.skuQuantity,
          skuSpec: record.skuSpec || null,
          remark: record.remark || null,
          batchId: batch.id,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    // 更新批次状态
    await db.update(importBatches)
      .set({ successCount, failCount, status: 'completed' })
      .where(eq(importBatches.id, batch.id));

    return NextResponse.json({
      data: { batchId: batch.id, successCount, failCount, duplicateCount, total: records.length }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '提交失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
