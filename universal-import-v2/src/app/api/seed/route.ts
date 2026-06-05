import { NextResponse } from 'next/server';
import { db } from '@/db';
import { rules } from '@/db/schema';
import { presetRules } from '@/lib/rules/presets';

export async function POST() {
  try {
    const inserted = [];
    for (const preset of presetRules) {
      const [rule] = await db.insert(rules).values({
        name: preset.name,
        description: preset.description,
        fileType: preset.fileType,
        config: preset.config,
      }).returning();
      inserted.push(rule);
    }
    return NextResponse.json({ data: inserted, count: inserted.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Seed失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
