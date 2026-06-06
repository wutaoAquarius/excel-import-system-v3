/**
 * 6份Demo文件的预置规则配置
 * 用于seed数据库或作为参考模板
 */
import type { RuleConfig } from './config';

// 1. 黎明屯配送发货单
export const liMingTunRule: RuleConfig = {
  fileType: 'excel',
  sheets: { type: 'active' },
  preprocessing: [
    { type: 'skipRows', count: 3 }, // 跳过标题+元信息行(Row1-3)
    {
      type: 'extractFooter',
      startRow: 'afterData',
      fields: [
        { target: 'receiverName', row: 'auto', col: 1, label: '收货人', labelCol: 0 },
        { target: 'receiverPhone', row: 'auto', col: 4, label: '收货电话', labelCol: 3 },
        { target: 'receiverAddress', row: 'auto', col: 13, label: '收货地址', labelCol: 12 },
      ],
    },
  ],
  dataExtraction: {
    mode: 'table',
    headerRow: 0, // 预处理后第一行是表头(原Row4)
    dataStartRow: 1,
    dataEndRow: 'auto',
    endMarkers: ['合计'],
  },
  fieldMapping: [
    { target: 'skuCode', source: { type: 'column', index: 2 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 3 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 5 }, transform: [{ type: 'trim' }] },
    { target: 'skuQuantity', source: { type: 'column', index: 14 }, transform: [{ type: 'toNumber' }] },
    { target: 'receiverName', source: { type: 'footer', fieldIndex: 0 } },
    { target: 'receiverPhone', source: { type: 'footer', fieldIndex: 1 } },
    { target: 'receiverAddress', source: { type: 'footer', fieldIndex: 2 } },
    { target: 'externalCode', source: { type: 'fixed', value: 'PS2512220005001' } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '黎明屯铁锅炖配送发货单 - 尾部信息区提取收货人' },
};

// 2. 湖南仓发货明细
export const huNanCangRule: RuleConfig = {
  fileType: 'excel',
  sheets: { type: 'active' },
  preprocessing: [
    { type: 'skipRows', count: 1 }, // 跳过首行说明文字（①带有*的字段为必填项...）
  ],
  dataExtraction: {
    mode: 'table',
    headerRow: 0,
    dataStartRow: 1,
    dataEndRow: 'auto',
  },
  fieldMapping: [
    { target: 'storeName', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
    { target: 'externalCode', source: { type: 'column', index: 2 }, transform: [{ type: 'trim' }] },
    { target: 'skuCode', source: { type: 'column', index: 5 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 6 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 8 }, transform: [{ type: 'trim' }] },
    { target: 'skuQuantity', source: { type: 'column', index: 12 }, transform: [{ type: 'toNumber' }] },
    { target: 'receiverName', source: { type: 'column', index: 26 }, transform: [{ type: 'trim' }] },
    { target: 'receiverPhone', source: { type: 'column', index: 27 }, transform: [{ type: 'trim' }] },
    { target: 'receiverAddress', source: { type: 'column', index: 28 }, transform: [{ type: 'trim' }] },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '湖南仓发货明细 - 跨行聚合（按配送单号分组）' },
};

// 3. 欢乐牧场模板 (矩阵转置)
export const huanLeMuChangRule: RuleConfig = {
  fileType: 'excel',
  sheets: { type: 'active' },
  preprocessing: [],
  dataExtraction: {
    mode: 'matrix',
    headerRow: 0,
    dataStartRow: 1,
    pivotStartCol: 13, // 从第14列开始是门店列
    pivotHeaderRow: 0,
    pivotTargetField: 'storeName',
    valueField: 'skuQuantity',
    skipZeroValues: true,
  },
  fieldMapping: [
    { target: 'skuName', source: { type: 'column', index: 2 }, transform: [{ type: 'trim' }] },
    { target: 'skuCode', source: { type: 'column', index: 3 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 7 } },
    { target: 'storeName', source: { type: 'columnName', name: 'pivot_header' } },
    { target: 'skuQuantity', source: { type: 'columnName', name: 'pivot_value' }, transform: [{ type: 'toNumber' }] },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '欢乐牧场 - 矩阵转置（SKU×门店矩阵）' },
};

// 4. 门店调拨单-卡片式
export const diaoBoDanRule: RuleConfig = {
  fileType: 'excel',
  sheets: { type: 'active' },
  preprocessing: [
    { type: 'skipRows', count: 3 }, // 跳过标题和元信息
    { type: 'cardSplit', boundary: '▶ 调拨记录', matchMode: 'startsWith' },
  ],
  dataExtraction: {
    mode: 'card',
    headerFields: [
      { row: 0, col: 1, target: 'storeName' },
      { row: 0, col: 3, target: 'receiverName' },
      { row: 0, col: 5, target: 'receiverPhone' },
      { row: 1, col: 1, target: 'receiverAddress' },
    ],
    tableConfig: {
      mode: 'table',
      headerRow: 2,
      dataStartRow: 3,
      dataEndRow: 'auto',
    },
  },
  fieldMapping: [
    { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 1 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 2 } },
    { target: 'skuQuantity', source: { type: 'column', index: 3 }, transform: [{ type: 'toNumber' }] },
    { target: 'storeName', source: { type: 'cardHeader', fieldIndex: 0 } },
    { target: 'receiverName', source: { type: 'cardHeader', fieldIndex: 1 } },
    { target: 'receiverPhone', source: { type: 'cardHeader', fieldIndex: 2 } },
    { target: 'receiverAddress', source: { type: 'cardHeader', fieldIndex: 3 } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '门店调拨单 - 卡片边界识别（▶标志）' },
};

// 5. 多门店分Sheet出库单
export const multiSheetRule: RuleConfig = {
  fileType: 'excel',
  sheets: { type: 'all' },
  preprocessing: [
    { type: 'skipRows', count: 3 }, // 跳过标题+元信息+空行
    {
      type: 'extractFooter',
      startRow: 'afterData',
      fields: [
        { target: 'storeName', row: 'auto', col: 1, label: '收货门店', labelCol: 0 },
        { target: 'receiverName', row: 'auto', col: 5, label: '联系人', labelCol: 4 },
        { target: 'receiverPhone', row: 'auto', col: 1, label: '联系电话', labelCol: 0 },
        { target: 'receiverAddress', row: 'auto', col: 5, label: '收货地址', labelCol: 4 },
      ],
    },
  ],
  dataExtraction: {
    mode: 'table',
    headerRow: 0,
    dataStartRow: 1,
    dataEndRow: 'auto',
    endMarkers: ['合计'],
  },
  fieldMapping: [
    { target: 'skuCode', source: { type: 'column', index: 1 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 2 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 3 } },
    { target: 'skuQuantity', source: { type: 'column', index: 5 }, transform: [{ type: 'toNumber' }] },
    { target: 'storeName', source: { type: 'footer', fieldIndex: 0 } },
    { target: 'receiverName', source: { type: 'footer', fieldIndex: 1 } },
    { target: 'receiverPhone', source: { type: 'footer', fieldIndex: 2 } },
    { target: 'receiverAddress', source: { type: 'footer', fieldIndex: 3 } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '多门店分Sheet出库单 - 多Sheet合并+底部横向收货人' },
};

// 6. 黔寨寨PDF配送单
export const qianZhaiZhaiRule: RuleConfig = {
  fileType: 'pdf',
  preprocessing: [],
  dataExtraction: {
    mode: 'text',
    linePatterns: [
      {
        pattern: '^\\d+\\S*?(ZBWP\\d+)(.+?)(?:件|包|桶|盒|瓶|袋|顶|码)(\\d+)\\s*$',
        captures: [
          { group: 1, target: 'skuCode' },
          { group: 2, target: 'skuName' },
          { group: 3, target: 'skuQuantity' },
        ],
      },
      {
        pattern: '收货人[：:]\\s*([^\\s收]+)',
        captures: [{ group: 1, target: 'receiverName' }],
      },
      {
        pattern: '收货电话[：:]\\s*(\\d+)',
        captures: [{ group: 1, target: 'receiverPhone' }],
      },
      {
        pattern: '收货地址[：:]\\s*(.+)',
        captures: [{ group: 1, target: 'receiverAddress' }],
      },
    ],
  },
  fieldMapping: [
    { target: 'skuCode', source: { type: 'columnName', name: 'skuCode' }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'columnName', name: 'skuName' }, transform: [{ type: 'trim' }] },
    { target: 'skuQuantity', source: { type: 'columnName', name: 'skuQuantity' }, transform: [{ type: 'toNumber' }] },
    { target: 'receiverName', source: { type: 'columnName', name: 'receiverName' } },
    { target: 'receiverPhone', source: { type: 'columnName', name: 'receiverPhone' } },
    { target: 'receiverAddress', source: { type: 'columnName', name: 'receiverAddress' } },
    { target: 'externalCode', source: { type: 'fixed', value: 'PS2604210007' } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '黔寨寨PDF配送单 - PDF解析+底部收货人' },
};

// 7. 门店配送确认单 (Word) - 纯文本解析，"━━━"分隔线
export const storeDeliveryConfirmRule: RuleConfig = {
  fileType: 'word',
  preprocessing: [],
  dataExtraction: {
    mode: 'text',
    separator: '━━━',
    linePatterns: [
      { pattern: '收货门店[：:]\\s*(.+)', captures: [{ group: 1, target: 'storeName' }] },
      { pattern: '收件人[：:]\\s*(.+)', captures: [{ group: 1, target: 'receiverName' }] },
      { pattern: '联系电话[：:]\\s*(.+)', captures: [{ group: 1, target: 'receiverPhone' }] },
      { pattern: '收货地址[：:]\\s*(.+)', captures: [{ group: 1, target: 'receiverAddress' }] },
      { pattern: '物品编码[：:]\\s*(.+)', captures: [{ group: 1, target: 'skuCode' }] },
      { pattern: '物品名称[：:]\\s*(.+)', captures: [{ group: 1, target: 'skuName' }] },
      { pattern: '发货数量[：:]\\s*(\\d+)', captures: [{ group: 1, target: 'skuQuantity' }] },
      { pattern: '规格型号[：:]\\s*(.+)', captures: [{ group: 1, target: 'skuSpec' }] },
    ],
  },
  fieldMapping: [
    { target: 'storeName', source: { type: 'columnName', name: 'storeName' } },
    { target: 'receiverName', source: { type: 'columnName', name: 'receiverName' } },
    { target: 'receiverPhone', source: { type: 'columnName', name: 'receiverPhone' } },
    { target: 'receiverAddress', source: { type: 'columnName', name: 'receiverAddress' } },
    { target: 'skuCode', source: { type: 'columnName', name: 'skuCode' } },
    { target: 'skuName', source: { type: 'columnName', name: 'skuName' } },
    { target: 'skuQuantity', source: { type: 'columnName', name: 'skuQuantity' }, transform: [{ type: 'toNumber' }] },
    { target: 'skuSpec', source: { type: 'columnName', name: 'skuSpec' } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '门店配送确认单(Word) - 纯文本解析（━━━分隔线）' },
};

// 8. 周配送计划 - 双重转置 + 复合单元格拆分
export const weeklyPlanRule: RuleConfig = {
  fileType: 'excel',
  sheets: { type: 'active' },
  preprocessing: [
    { type: 'skipRows', count: 2 }, // 跳过标题行
  ],
  dataExtraction: {
    mode: 'matrix',
    headerRow: 0,
    dataStartRow: 1,
    pivotStartCol: 2,       // 从第3列起是日期/门店列
    pivotHeaderRow: 0,
    pivotTargetField: 'storeName',
    valueField: 'skuQuantity',
    skipZeroValues: true,
  },
  fieldMapping: [
    { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 1 }, transform: [{ type: 'trim' }] },
    { target: 'storeName', source: { type: 'columnName', name: 'pivot_header' } },
    { target: 'skuQuantity', source: { type: 'columnName', name: 'pivot_value' }, transform: [{ type: 'toNumber' }] },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '周配送计划 - 双重转置+复合单元格拆分（SKU×门店×日期）' },
};

// 9. 配送签收单(多单PDF) - 多单PDF解析，按页拆分
export const multiOrderPdfRule: RuleConfig = {
  fileType: 'pdf',
  preprocessing: [
    { type: 'cardSplit', boundary: '签收单', matchMode: 'contains' }, // 按"签收单"标题拆分多个独立单据
    { type: 'skipRows', count: 5 }, // 跳过页眉
    {
      type: 'extractFooter',
      startRow: 'afterData',
      fields: [
        { target: 'receiverName', row: 'auto', col: 0, label: '签收人' },
        { target: 'receiverPhone', row: 'auto', col: 0, label: '联系电话' },
        { target: 'receiverAddress', row: 'auto', col: 0, label: '收货地址' },
        { target: 'storeName', row: 'auto', col: 0, label: '收货门店' },
      ],
    },
  ],
  dataExtraction: {
    mode: 'table',
    headerRow: 0,
    dataStartRow: 1,
    dataEndRow: 'auto',
    endMarkers: ['合计', '签收'],
  },
  fieldMapping: [
    { target: 'externalCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
    { target: 'skuCode', source: { type: 'column', index: 1 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 2 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 3 } },
    { target: 'skuQuantity', source: { type: 'column', index: 4 }, transform: [{ type: 'toNumber' }] },
    { target: 'storeName', source: { type: 'footer', fieldIndex: 3 } },
    { target: 'receiverName', source: { type: 'footer', fieldIndex: 0 } },
    { target: 'receiverPhone', source: { type: 'footer', fieldIndex: 1 } },
    { target: 'receiverAddress', source: { type: 'footer', fieldIndex: 2 } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '配送签收单(多单PDF) - 按页拆分多单+底部签收信息' },
};

export const presetRules = [
  { name: '黎明屯配送发货单', description: '尾部信息区提取收货人', fileType: 'excel', config: liMingTunRule },
  { name: '湖南仓发货明细', description: '跨行聚合（按配送单号分组）', fileType: 'excel', config: huNanCangRule },
  { name: '欢乐牧场模板', description: '矩阵转置（SKU×门店矩阵）', fileType: 'excel', config: huanLeMuChangRule },
  { name: '门店调拨单-卡片式', description: '卡片边界识别', fileType: 'excel', config: diaoBoDanRule },
  { name: '多门店分Sheet出库单', description: '多Sheet合并+底部横向收货人', fileType: 'excel', config: multiSheetRule },
  { name: '黔寨寨配送单(PDF)', description: 'PDF解析+底部收货人', fileType: 'pdf', config: qianZhaiZhaiRule },
  { name: '门店配送确认单(Word)', description: '纯文本解析（━━━分隔线）', fileType: 'word', config: storeDeliveryConfirmRule },
  { name: '周配送计划', description: '双重转置+复合单元格拆分', fileType: 'excel', config: weeklyPlanRule },
  { name: '配送签收单(多单PDF)', description: '多单PDF解析', fileType: 'pdf', config: multiOrderPdfRule },
];
