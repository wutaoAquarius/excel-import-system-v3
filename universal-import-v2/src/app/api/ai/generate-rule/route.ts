import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const SYSTEM_PROMPT = `你是一个文件结构分析专家。你的任务是分析上传文件的数据结构，并生成一个解析规则配置(RuleConfig JSON)。

规则配置的TypeScript类型如下：
\`\`\`typescript
interface RuleConfig {
  fileType: 'excel' | 'pdf' | 'word';
  sheets?: { type: 'all' } | { type: 'active' } | { type: 'byIndex', indices: number[] };
  preprocessing: PreprocessStep[];
  dataExtraction: DataExtractionConfig;
  fieldMapping: FieldMapping[];
  postprocessing: PostprocessStep[];
}

type PreprocessStep = 
  | { type: 'skipRows', count: number }
  | { type: 'extractFooter', startRow: number | 'afterData', fields: FooterField[] }
  | { type: 'cardSplit', boundary: string, matchMode: 'startsWith' | 'contains' | 'regex' }
  | { type: 'filterEmptyRows', minNonEmpty?: number }

type DataExtractionConfig =
  | { mode: 'table', headerRow: number, dataStartRow: number, dataEndRow?: number | 'auto', endMarkers?: string[] }
  | { mode: 'matrix', headerRow: number, dataStartRow: number, pivotStartCol: number, pivotHeaderRow: number, pivotTargetField: string, valueField: string, skipZeroValues?: boolean }
  | { mode: 'grouped', headerRow: number, dataStartRow: number, groupByCol: number, sharedFields: FieldMapping[] }
  | { mode: 'card', headerFields: CardHeaderField[], tableConfig: TableExtraction }

interface FieldMapping {
  target: 'externalCode' | 'storeName' | 'receiverName' | 'receiverPhone' | 'receiverAddress' | 'skuCode' | 'skuName' | 'skuQuantity' | 'skuSpec' | 'remark';
  source: { type: 'column', index: number } | { type: 'columnName', name: string } | { type: 'fixed', value: string } | { type: 'footer', fieldIndex: number } | { type: 'cardHeader', fieldIndex: number };
  transform?: ({ type: 'trim' } | { type: 'toNumber' })[];
  confidence?: number; // 0-1 表示你对这个映射的确信程度
}
\`\`\`

运单标准字段说明：
- externalCode: 外部编码/单据号（用于去重聚合）
- storeName: 收货门店名称
- receiverName: 收件人姓名
- receiverPhone: 收件人电话
- receiverAddress: 收件人地址
- skuCode: SKU物品编码（必填）
- skuName: SKU物品名称（必填）
- skuQuantity: SKU发货数量（必填，正数）
- skuSpec: 规格型号
- remark: 备注

要求：
1. 只输出JSON，不要任何解释文字
2. 对于每个fieldMapping，标注confidence值（0-1），表示你的确信程度
3. 分析文件结构，选择最合适的dataExtraction模式
4. 如果收货信息在数据区之外（如文件尾部），使用extractFooter预处理步骤`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { preview, fileName, fileType, sheetNames } = body;

    if (!preview || !fileName) {
      return NextResponse.json({ error: '缺少文件预览数据' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API Key未配置' }, { status: 500 });
    }

    // 构造用户prompt
    const userPrompt = `请分析以下文件并生成解析规则：

文件名: ${fileName}
文件类型: ${fileType}
${sheetNames ? `Sheet列表: ${sheetNames.join(', ')}` : ''}

文件前20行数据样本（JSON格式）:
\`\`\`json
${JSON.stringify(preview.slice(0, 20), null, 2)}
\`\`\`

请输出完整的RuleConfig JSON配置。`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `DeepSeek API调用失败: ${response.status} ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'AI未返回有效内容' }, { status: 502 });
    }

    // 解析AI返回的JSON
    let ruleConfig;
    try {
      ruleConfig = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'AI返回的内容不是有效JSON', raw: content },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: {
        ruleConfig,
        generatedBy: 'ai',
        model: 'deepseek-chat',
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'AI规则生成失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
