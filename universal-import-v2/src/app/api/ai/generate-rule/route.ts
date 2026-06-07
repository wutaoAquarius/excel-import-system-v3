import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `你是物流/快递行业的文件结构分析专家。你的任务是分析上传文件的原始数据，识别其中的运单信息，生成精确的解析规则配置 JSON。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 目标字段

| 字段 | 键名 | 说明 | 必填 |
|------|------|------|------|
| 外部编码 | externalCode | 单据号/配送单号 | 否 |
| 收货门店 | storeName | 收货机构/门店名称 | A/B组二选一 |
| 收件人姓名 | receiverName | 收货人/联系人 | A/B组二选一 |
| 收件人电话 | receiverPhone | 收货电话 | A/B组二选一 |
| 收件人地址 | receiverAddress | 收货地址 | A/B组二选一 |
| SKU物品编码 | skuCode | 物品编码 | **必填** |
| SKU物品名称 | skuName | 物品名称 | **必填** |
| SKU发货数量 | skuQuantity | 发货数量 | **必填** |
| SKU规格型号 | skuSpec | 规格型号 | 否 |
| 备注 | remark | 备注 | 否 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 输出 JSON 格式（严格遵守）

\`\`\`typescript
interface RuleConfig {
  file_type: 'excel' | 'pdf';
  multi_sheet: boolean;
  sheet_name_source?: 'sheet_name' | 'cell' | 'keyword' | null;
  header: HeaderField[];
  detail: DetailConfig;
  metadata?: { generatedBy: 'ai'; description: string };
}

interface HeaderField {
  field: string;         // 目标字段英文键名
  method: 'keyword' | 'cell' | 'sheet_name';
  keyword?: string;      // method=keyword 时的搜索关键词
  direction?: 'right' | 'below';
  separator?: string;    // 分隔符
  row?: number;          // method=cell 时行号(0-based)
  col?: number;          // method=cell 时列号(0-based)
  post_process: string;  // keep | trim | convert_to_number | extract_code:正则
  description: string;   // 提取说明（中文）
}

interface DetailConfig {
  start_row?: number;       // 数据起始行(0-based)
  end_condition?: string;   // 'blank_row' | 'next_keyword:合计'
  method?: 'pdf_table';     // PDF专用
  table_keyword?: string;   // PDF定位表头关键词
  block_separator?: string; // 卡片分隔标记
  group_by?: string;        // 分组字段
  pivot?: PivotConfig;      // 矩阵转置
  columns: DetailColumn[];
}

interface PivotConfig {
  pivot_start_col: number;
  pivot_end_col?: number;
  exclude_patterns?: string[];
  pivot_target_field: string;
  value_field: string;
  skip_zero_values: boolean;
}

interface DetailColumn {
  field: string;
  col: number;
  post_process: string;
  description: string;
}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 分析步骤

### Step 1: 识别文件结构类型
1. **平铺表格**：有表头行，每行一条完整记录 → header + detail.columns
2. **头尾分离**：SKU在中间表格，收货信息在上方/下方独立行 → header用keyword/cell + detail
3. **矩阵转置**：一个轴是SKU，另一轴是门店/日期，交叉格是数量 → detail.pivot
4. **分组聚合**：多行SKU共享同一组收货信息（按单号分组）→ detail.group_by
5. **卡片式**：重复的"卡片块"，每块独立收货信息+SKU列表 → detail.block_separator
6. **多Sheet**：每个Sheet是独立订单 → multi_sheet=true + sheet_name_source

### Step 2: 定位数据区域
- header 字段：使用 method='keyword'（搜索标签文本）或 method='cell'（固定坐标）
- detail 明细区：确定 start_row 和 end_condition
- 行号从0开始计数

### Step 3: 建立字段映射
- header[] 中填写头部全局字段（收货人、门店、编码等）
- detail.columns[] 中填写明细行字段（SKU编码、名称、数量等）
- 每个字段必须填写 description 说明

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## post_process 说明
- \`keep\`: 保持原样
- \`trim\`: 去除首尾空格
- \`convert_to_number\`: 转为数字（skuQuantity 必须使用）
- \`extract_code: 正则\`: 用正则提取匹配内容（如 \`extract_code: PS\\d+\`）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## description 字段要求

为每个 header 字段和 detail column 填写中文说明，告诉用户该字段是如何从文件中提取的。
示例：
- "搜索包含'配送发货单'的单元格，取其右侧内容，用正则 PS\\d+ 提取编码"
- "取第2行第2列(B2)的单元格值作为收货门店名称"
- "明细表格第3列(C列)，即表头为'物品编码'的列"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 参考示例

### 示例1：头尾分离
\`\`\`json
{
  "file_type": "excel",
  "multi_sheet": false,
  "sheet_name_source": null,
  "header": [
    {"field": "externalCode", "method": "keyword", "keyword": "配送发货单", "direction": "right", "separator": "PS", "post_process": "extract_code: PS\\\\d+", "description": "搜索'配送发货单'取右侧PS编码"},
    {"field": "storeName", "method": "cell", "row": 1, "col": 1, "post_process": "keep", "description": "取B2单元格"},
    {"field": "receiverName", "method": "keyword", "keyword": "收货人", "direction": "right", "separator": "：", "post_process": "keep", "description": "搜索'收货人'取冒号后值"},
    {"field": "receiverPhone", "method": "keyword", "keyword": "收货电话", "direction": "right", "separator": "：", "post_process": "keep", "description": "搜索'收货电话'取冒号后值"}
  ],
  "detail": {
    "start_row": 4,
    "end_condition": "next_keyword:合计",
    "columns": [
      {"field": "skuCode", "col": 2, "post_process": "keep", "description": "C列物品编码"},
      {"field": "skuName", "col": 3, "post_process": "keep", "description": "D列物品名称"},
      {"field": "skuQuantity", "col": 14, "post_process": "convert_to_number", "description": "O列发货数量"}
    ]
  },
  "metadata": {"generatedBy": "ai", "description": "配送发货单-头尾分离结构"}
}
\`\`\`

### 示例2：矩阵转置
\`\`\`json
{
  "file_type": "excel",
  "multi_sheet": false,
  "header": [],
  "detail": {
    "start_row": 1,
    "end_condition": "blank_row",
    "pivot": {
      "pivot_start_col": 13,
      "exclude_patterns": ["结余", "合计"],
      "pivot_target_field": "storeName",
      "value_field": "skuQuantity",
      "skip_zero_values": true
    },
    "columns": [
      {"field": "skuName", "col": 2, "post_process": "trim", "description": "C列SKU名称"},
      {"field": "skuCode", "col": 4, "post_process": "keep", "description": "E列商品编码"}
    ]
  },
  "metadata": {"generatedBy": "ai", "description": "SKU×门店矩阵转置"}
}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 输出要求
1. 只输出一个完整的 RuleConfig JSON 对象，不要任何解释文字
2. 必须为每个 header 和 column 填写 description
3. skuQuantity 的 post_process 必须为 convert_to_number
4. 尽可能映射所有能找到的字段
5. metadata.description 简述文件结构特征
6. 不要输出任何额外文字`;

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

    const totalRows = preview.length;

    // 构造用户 prompt
    let userPrompt = '分析以下文件并生成 RuleConfig JSON：\n\n';
    userPrompt += '【文件基本信息】\n';
    userPrompt += '- 文件名: ' + fileName + '\n';
    userPrompt += '- 文件类型: ' + fileType + '\n';
    userPrompt += '- 总行数: ' + totalRows + '\n';
    if (sheetNames) {
      userPrompt += '- Sheet列表: ' + sheetNames.join(', ') + '（共' + sheetNames.length + '个）\n';
    }
    userPrompt += '\n【文件完整数据（全部' + totalRows + '行）】\n';
    userPrompt += '```json\n' + JSON.stringify(preview, null, 2) + '\n```\n\n';
    userPrompt += '请按照系统提示中的分析步骤，输出完整的 RuleConfig JSON。';

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: 'DeepSeek API调用失败: ' + response.status + ' ' + errText },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'AI未返回有效内容' }, { status: 502 });
    }

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
      data: { ruleConfig, generatedBy: 'ai', model: 'deepseek-chat' }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'AI规则生成失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
