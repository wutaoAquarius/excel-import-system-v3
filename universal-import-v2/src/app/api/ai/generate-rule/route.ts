import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const SYSTEM_PROMPT = `你是物流/快递行业的文件结构分析专家。你的任务是分析上传文件的原始数据，识别其中的运单信息，生成精确的解析规则配置（RuleConfig JSON）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 目标字段（尽可能找到所有字段的对应值）

| 字段 | 键名 | 说明 | 必填 |
|------|------|------|------|
| 外部编码 | externalCode | 单据号/配送单号/订单号，用于去重聚合 | 否 |
| 收货门店 | storeName | 收货机构/门店名称 | A/B组二选一 |
| 收件人姓名 | receiverName | 收货人/联系人 | A/B组二选一 |
| 收件人电话 | receiverPhone | 收货电话/联系电话 | A/B组二选一 |
| 收件人地址 | receiverAddress | 收货地址/送货地址 | A/B组二选一 |
| SKU物品编码 | skuCode | 物品编码/商品编码/SKU编码 | **必填** |
| SKU物品名称 | skuName | 物品名称/商品名称 | **必填** |
| SKU发货数量 | skuQuantity | 发货数量/出库数量/订货数量（正整数） | **必填** |
| SKU规格型号 | skuSpec | 规格型号/规格/包装规格 | 否 |
| 备注 | remark | 备注/说明 | 否 |

**校验规则**：A组（仅storeName即可）或B组（receiverName + receiverPhone + receiverAddress三个都填），至少满足一组。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 分析步骤（按顺序执行）

### Step 1: 识别文件结构类型

1. **平铺表格(table)**：有明确表头行，每行是一条完整记录
   - 特征：前几行是列名，后面每行数据格式一致

2. **头尾分离(table + extractFooter)**：SKU在中间表格，收货信息在上方/下方独立行
   - 特征：数据区外存在"收货人："/"联系电话："/"收货地址："等标签文本
   - 关键：数据区通常以"合计"/"小计"行结束，收货信息在其后

3. **矩阵转置(matrix)**：一个轴是SKU，另一个轴是门店/日期，交叉格是数量
   - 特征：列头是门店名或日期，行头是商品信息，中间格子是数字或null
   - 关键：skipZeroValues=true跳过空值和0

4. **分组聚合(grouped)**：多个SKU行共享同一组收货信息，通过某个字段分组
   - 特征：某列（如配送单号）有重复值，同一值的多行属于同一订单

5. **卡片式(card)**：重复的"卡片块"，每块有独立的收货信息+SKU列表
   - 特征：有明显分隔标志（如"▶ 记录 #N"、特殊符号行）

6. **多Sheet(sheets: {type:'all'})**：每个Sheet是独立的出库单
   - 特征：多个Sheet名像门店名/编号，结构相同

### Step 2: 定位三个区域

- **元数据区**（头部前1-5行）：单据号、日期、机构名等全局信息
- **数据明细区**（中部）：SKU表格，找表头行(headerRow)和数据起始行(dataStartRow)
- **收货信息区**（头部/尾部/行内）：收货人、电话、地址

识别线索：
- "收货"/"收件"/"联系人"/"电话"/"地址"/"门店" → 收货信息
- "编码"/"物品"/"名称"/"数量"/"规格" → SKU数据列
- "合计"/"总计" → 数据区结束标志(endMarkers)
- PS/DH/DB + 数字串 → 外部编码

### Step 3: 建立字段映射

确定每个字段的数据来源 source 类型：
- \`{ type: 'column', index: N }\`: 按列号（0-based）
- \`{ type: 'columnName', name: '列头文字' }\`: 按表头名匹配
- \`{ type: 'footer', fieldIndex: N }\`: 来自extractFooter提取的第N个字段
- \`{ type: 'cardHeader', fieldIndex: N }\`: 来自卡片头的第N个字段
- \`{ type: 'fixed', value: '固定值' }\`: 固定值
- \`{ type: 'regex', pattern: '正则', group: N }\`: 正则提取（PDF文本）
- \`{ type: 'concat', sources: [...], separator: ' ' }\`: 多来源拼接

### Step 4: 标注置信度 confidence

- 1.0: 列名完全匹配（列头就叫"物品编码"）
- 0.9: 语义高度吻合（如"商品名"→skuName）
- 0.7: 位置+格式推断（如"此列全是数字且列头含'数量'"）
- 0.5: 不确定的推测

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 常见中文标签 → 字段映射参考

| 源文件中可能出现的标签 | 映射目标 |
|----------------------|----------|
| 单据号/单据编号/配送单号/出库单号/调拨单号 | externalCode |
| 收货机构/收货门店/门店/调入门店/客户名称 | storeName |
| 收货人/收件人/联系人/签收人 | receiverName |
| 收货电话/联系电话/手机号/电话 | receiverPhone |
| 收货地址/送货地址/地址 | receiverAddress |
| 物品编码/商品编码/SKU编码/货号/外部商品编码 | skuCode |
| 物品名称/商品名称/品名/SKU名称/货品名 | skuName |
| 发货数量/出库数量/数量/实发数/订货数量 | skuQuantity |
| 规格型号/规格/包装规格/单位规格 | skuSpec |
| 备注/说明/批注 | remark |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## RuleConfig TypeScript 类型定义

\`\`\`typescript
interface RuleConfig {
  fileType: 'excel' | 'pdf' | 'word';
  sheets?: { type: 'all' } | { type: 'active' } | { type: 'byIndex'; indices: number[] } | { type: 'byName'; names: string[] };
  preprocessing: PreprocessStep[];
  dataExtraction: DataExtractionConfig;
  fieldMapping: FieldMapping[];
  postprocessing: PostprocessStep[];
  metadata?: { generatedBy: 'ai'; confidence: number; description: string };
}

type PreprocessStep =
  | { type: 'skipRows'; count: number }
  | { type: 'extractFooter'; startRow: number | 'afterData'; fields: FooterField[] }
  | { type: 'cardSplit'; boundary: string; matchMode: 'startsWith' | 'contains' | 'regex' }
  | { type: 'filterEmptyRows'; minNonEmpty?: number }

interface FooterField {
  target: WaybillField;
  row: number | 'auto';
  col: number;
  label?: string;
  labelCol?: number;
}

type DataExtractionConfig =
  | { mode: 'table'; headerRow: number; dataStartRow: number; dataEndRow?: number | 'auto'; endMarkers?: string[] }
  | { mode: 'matrix'; headerRow: number; dataStartRow: number; pivotStartCol: number; pivotHeaderRow: number; pivotTargetField: WaybillField; valueField: WaybillField; skipZeroValues?: boolean }
  | { mode: 'grouped'; headerRow: number; dataStartRow: number; groupByCol: number; sharedFields: FieldMapping[] }
  | { mode: 'card'; headerFields: CardHeaderField[]; tableConfig: { mode: 'table'; headerRow: number; dataStartRow: number; dataEndRow?: number | 'auto'; endMarkers?: string[] } }
  | { mode: 'text'; separator?: string; linePatterns: { pattern: string; captures: { group: number; target: WaybillField }[] }[] }

interface CardHeaderField {
  row: number;
  col: number;
  target: WaybillField;
  labelCol?: number;
  label?: string;
}

interface FieldMapping {
  target: WaybillField;
  source: FieldSource;
  transform?: TransformStep[];
  confidence?: number;
}

type FieldSource =
  | { type: 'column'; index: number }
  | { type: 'columnName'; name: string }
  | { type: 'fixed'; value: string }
  | { type: 'footer'; fieldIndex: number }
  | { type: 'cardHeader'; fieldIndex: number }
  | { type: 'regex'; pattern: string; group: number }
  | { type: 'concat'; sources: FieldSource[]; separator?: string }

type TransformStep =
  | { type: 'trim' }
  | { type: 'toNumber' }
  | { type: 'replace'; pattern: string; replacement: string }
  | { type: 'split'; separator: string; index: number }
  | { type: 'prefix'; value: string }
  | { type: 'suffix'; value: string }
  | { type: 'regex'; pattern: string; group: number }

type PostprocessStep =
  | { type: 'dedup'; by: WaybillField }
  | { type: 'filterEmpty'; requiredFields: WaybillField[] }
  | { type: 'mergeRows'; groupBy: WaybillField; mergeField: WaybillField; separator: string }

type WaybillField = 'externalCode' | 'storeName' | 'receiverName' | 'receiverPhone' | 'receiverAddress' | 'skuCode' | 'skuName' | 'skuQuantity' | 'skuSpec' | 'remark';
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 输出要求

1. 只输出一个完整的 RuleConfig JSON 对象，不要任何解释文字
2. 必须为每个 fieldMapping 标注 confidence 值
3. 必须包含 metadata 字段，填写 description 简述文件结构特征
4. skuQuantity 的 transform 必须包含 { type: 'toNumber' }
5. 尽可能映射所有能找到的字段，不要只映射必填字段
6. postprocessing 中添加 filterEmpty 确保 skuCode 和 skuName 非空`;

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

    // 构造用户prompt - 提供尽可能多的文件上下文
    const totalRows = preview.length;
    const headSample = preview.slice(0, 25);
    const tailSample = totalRows > 30 ? preview.slice(-8) : [];

    const userPrompt = `分析以下文件并生成RuleConfig JSON：

【文件基本信息】
- 文件名: ${fileName}
- 文件类型: ${fileType}
- 总行数: ${totalRows}
${sheetNames ? `- Sheet列表: ${sheetNames.join(', ')}（共${sheetNames.length}个）` : ''}

【文件头部数据（前25行）】
\`\`\`json
${JSON.stringify(headSample, null, 2)}
\`\`\`
${tailSample.length > 0 ? `
【文件尾部数据（最后8行）】- 注意：收货人/地址/电话信息常出现在尾部
\`\`\`json
${JSON.stringify(tailSample, null, 2)}
\`\`\`` : ''}

请按照系统提示中的分析步骤，输出完整的RuleConfig JSON。`;

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
