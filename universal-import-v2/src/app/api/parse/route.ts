import { NextRequest, NextResponse } from 'next/server';
import { executeRule } from '@/lib/rules';
import type { RuleConfig } from '@/lib/rules';
import type { RawFileData } from '@/lib/parsers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawData, ruleConfig } = body as {
      rawData: RawFileData;
      ruleConfig: RuleConfig;
    };

    if (!rawData || !ruleConfig) {
      return NextResponse.json({ error: '缺少文件数据或规则配置' }, { status: 400 });
    }

    const records = executeRule(rawData, ruleConfig);

    return NextResponse.json({
      data: {
        records,
        totalCount: records.length,
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '解析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
