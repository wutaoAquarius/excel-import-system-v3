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
      startRow: 8, // Row9开始是footer(0-based=8)
      fields: [
        { target: 'receiverName', row: 8, col: 1, label: '收货人', labelCol: 0 },
        { target: 'receiverPhone', row: 8, col: 4, label: '收货电话', labelCol: 3 },
        { target: 'receiverAddress', row: 8, col: 13, label: '收货地址', labelCol: 12 },
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
  preprocessing: [],
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
      { row: 1, col: 1, target: 'storeName' },
      { row: 1, col: 3, target: 'receiverName' },
      { row: 1, col: 5, target: 'receiverPhone' },
      { row: 2, col: 1, target: 'receiverAddress' },
    ],
    tableConfig: {
      mode: 'table',
      headerRow: 3,
      dataStartRow: 4,
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
  preprocessing: [
    { type: 'skipRows', count: 7 }, // 跳过头部元信息
    {
      type: 'extractFooter',
      startRow: 'afterData',
      fields: [
        { target: 'receiverName', row: 'auto', col: 0, label: '收货人' },
        { target: 'receiverPhone', row: 'auto', col: 0, label: '收货电话' },
        { target: 'receiverAddress', row: 'auto', col: 0, label: '收货地址' },
      ],
    },
  ],
  dataExtraction: {
    mode: 'table',
    headerRow: 0,
    dataStartRow: 1,
    dataEndRow: 'auto',
    endMarkers: ['合计', '制单日期'],
  },
  fieldMapping: [
    { target: 'skuCode', source: { type: 'column', index: 2 }, transform: [{ type: 'trim' }] },
    { target: 'skuName', source: { type: 'column', index: 3 }, transform: [{ type: 'trim' }] },
    { target: 'skuSpec', source: { type: 'column', index: 4 } },
    { target: 'skuQuantity', source: { type: 'column', index: 6 }, transform: [{ type: 'toNumber' }] },
    { target: 'receiverName', source: { type: 'footer', fieldIndex: 0 } },
    { target: 'receiverPhone', source: { type: 'footer', fieldIndex: 1 } },
    { target: 'receiverAddress', source: { type: 'footer', fieldIndex: 2 } },
    { target: 'externalCode', source: { type: 'fixed', value: 'PS2604210007' } },
  ],
  postprocessing: [
    { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
  ],
  metadata: { generatedBy: 'manual', description: '黔寨寨PDF配送单 - PDF解析+底部收货人' },
};

export const presetRules = [
  { name: '黎明屯配送发货单', description: '尾部信息区提取收货人', fileType: 'excel', config: liMingTunRule },
  { name: '湖南仓发货明细', description: '跨行聚合（按配送单号分组）', fileType: 'excel', config: huNanCangRule },
  { name: '欢乐牧场模板', description: '矩阵转置（SKU×门店矩阵）', fileType: 'excel', config: huanLeMuChangRule },
  { name: '门店调拨单-卡片式', description: '卡片边界识别', fileType: 'excel', config: diaoBoDanRule },
  { name: '多门店分Sheet出库单', description: '多Sheet合并+底部横向收货人', fileType: 'excel', config: multiSheetRule },
  { name: '黔寨寨配送单(PDF)', description: 'PDF解析+底部收货人', fileType: 'pdf', config: qianZhaiZhaiRule },
];
