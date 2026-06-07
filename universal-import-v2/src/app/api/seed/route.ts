import { NextResponse } from 'next/server';
import { db } from '@/db';
import { rules, orders, importBatches } from '@/db/schema';

// 清理所有数据并用新预置规则重新 seed
export async function POST() {
  try {
    // 清理所有表
    await db.delete(orders);
    await db.delete(importBatches);
    await db.delete(rules);

    // 导入新预置规则
    const { presetRules } = await import('@/lib/rules/presets');
    for (const preset of presetRules) {
      await db.insert(rules).values({
        name: preset.name,
        description: preset.rule.metadata?.description ?? '',
        fileType: preset.rule.file_type,
        config: preset.rule,
      });
    }

    return NextResponse.json({
      data: { message: '数据已清理，已导入 ' + presetRules.length + ' 条预置规则' }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '清理失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
