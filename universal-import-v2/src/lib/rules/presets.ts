/**
 * 6条核心预置规则配置（UnifiedRuleConfig 格式）
 * 已移除 Word 相关规则（门店配送确认单、周配送计划、配送签收单多单PDF）
 */
import type { RuleConfig } from './config';

// 1. 黎明屯配送发货单（头尾分离：header keyword/cell + detail table）
const liMingTunRule: RuleConfig = {
  file_type: 'excel',
  multi_sheet: false,
  sheet_name_source: null,
  header: [
    {
      field: 'externalCode',
      method: 'keyword',
      keyword: '配送发货单',
      direction: 'right',
      separator: 'PS',
      post_process: 'extract_code: PS\\d+',
      description: "搜索'配送发货单'关键词，取右侧 PS 开头编码",
    },
    {
      field: 'storeName',
      method: 'cell',
      row: 1,
      col: 1,
      post_process: 'keep',
      description: '取 B2 单元格作为收货门店名称',
    },
    {
      field: 'receiverName',
      method: 'keyword',
      keyword: '收货人',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货人'关键词，取右侧冒号后的值",
    },
    {
      field: 'receiverPhone',
      method: 'keyword',
      keyword: '收货电话',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货电话'关键词，取右侧冒号后的值",
    },
    {
      field: 'receiverAddress',
      method: 'keyword',
      keyword: '收货地址',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货地址'关键词，取右侧冒号后的值",
    },
  ],
  detail: {
    start_row: 4,
    end_condition: 'next_keyword:合计',
    columns: [
      { field: 'skuCode',     col: 2,  post_process: 'keep',             description: 'C列物品编码' },
      { field: 'skuName',     col: 3,  post_process: 'keep',             description: 'D列物品名称' },
      { field: 'skuSpec',     col: 5,  post_process: 'keep',             description: 'F列规格型号' },
      { field: 'skuQuantity', col: 14, post_process: 'convert_to_number', description: 'O列发货数量' },
      { field: 'remark',      col: 39, post_process: 'keep',             description: 'AN列备注' },
    ],
  },
  metadata: { generatedBy: 'manual', description: '黎明屯铁锅炖配送发货单 - 头尾分离，关键词提取头部信息' },
};

// 2. 湖南仓发货明细（分组聚合：detail.group_by）
const huNanCangRule: RuleConfig = {
  file_type: 'excel',
  multi_sheet: false,
  sheet_name_source: null,
  header: [],
  detail: {
    start_row: 2,
    end_condition: 'blank_row',
    group_by: 'externalCode',
    columns: [
      { field: 'storeName',       col: 0,  post_process: 'keep',             description: 'A列收货门店名称' },
      { field: 'externalCode',    col: 2,  post_process: 'keep',             description: 'C列配送单号（分组依据）' },
      { field: 'skuCode',         col: 5,  post_process: 'keep',             description: 'F列物品编码' },
      { field: 'skuName',         col: 6,  post_process: 'keep',             description: 'G列物品名称' },
      { field: 'skuSpec',         col: 8,  post_process: 'keep',             description: 'I列规格型号' },
      { field: 'skuQuantity',     col: 12, post_process: 'convert_to_number', description: 'M列发货数量' },
      { field: 'receiverName',    col: 26, post_process: 'keep',             description: 'AA列收件人姓名' },
      { field: 'receiverPhone',   col: 27, post_process: 'keep',             description: 'AB列收件人电话' },
      { field: 'receiverAddress', col: 28, post_process: 'keep',             description: 'AC列收件人地址' },
    ],
  },
  metadata: { generatedBy: 'manual', description: '湖南仓发货明细 - 分组聚合，按配送单号分组归并多行' },
};

// 3. 欢乐牧场模板（矩阵转置：detail.pivot）
const huanLeMuChangRule: RuleConfig = {
  file_type: 'excel',
  multi_sheet: false,
  sheet_name_source: null,
  header: [],
  detail: {
    start_row: 1,
    end_condition: 'blank_row',
    pivot: {
      pivot_start_col: 13,
      exclude_patterns: ['结余', '合计'],
      pivot_target_field: 'storeName',
      value_field: 'skuQuantity',
      skip_zero_values: true,
    },
    columns: [
      { field: 'skuName', col: 2, post_process: 'keep', description: 'C列物品名称（转置后保留为行固定字段）' },
      { field: 'skuCode', col: 4, post_process: 'keep', description: 'E列物品编码' },
      { field: 'skuSpec', col: 7, post_process: 'keep', description: 'H列规格型号' },
    ],
  },
  metadata: { generatedBy: 'manual', description: '欢乐牧场 - 矩阵转置，SKU×门店矩阵展开为明细行' },
};

// 4. 门店调拨单-卡片式（卡片分隔：detail.block_separator）
const diaoBoDanRule: RuleConfig = {
  file_type: 'excel',
  multi_sheet: false,
  sheet_name_source: null,
  header: [
    {
      field: 'externalCode',
      method: 'keyword',
      keyword: '调拨单号',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'调拨单号'关键词，取右侧值作为外部编码",
    },
  ],
  detail: {
    start_row: 4,
    end_condition: 'blank_row',
    block_separator: '▶ 调拨记录',
    columns: [
      { field: 'storeName',       col: 1, post_process: 'keep',             description: 'B列收货门店（卡片头部行取值）' },
      { field: 'receiverName',    col: 3, post_process: 'keep',             description: 'D列收件人姓名（卡片头部行取值）' },
      { field: 'receiverPhone',   col: 5, post_process: 'keep',             description: 'F列收件人电话（卡片头部行取值）' },
      { field: 'receiverAddress', col: 1, post_process: 'keep',             description: 'B列收件人地址（卡片第二行取值）' },
      { field: 'skuCode',         col: 0, post_process: 'keep',             description: 'A列物品编码（明细表格区）' },
      { field: 'skuName',         col: 1, post_process: 'keep',             description: 'B列物品名称（明细表格区）' },
      { field: 'skuSpec',         col: 2, post_process: 'keep',             description: 'C列规格型号（明细表格区）' },
      { field: 'skuQuantity',     col: 3, post_process: 'convert_to_number', description: 'D列调拨数量（明细表格区）' },
    ],
  },
  metadata: { generatedBy: 'manual', description: '门店调拨单 - 卡片式布局，▶标志为卡片分隔边界' },
};

// 5. 多门店分Sheet出库单（multi_sheet + sheet_name_source）
const multiSheetRule: RuleConfig = {
  file_type: 'excel',
  multi_sheet: true,
  sheet_name_source: 'sheet_name',
  header: [
    {
      field: 'storeName',
      method: 'sheet_name',
      post_process: 'keep',
      description: '以 Sheet 页签名称作为收货门店名称',
    },
    {
      field: 'receiverName',
      method: 'keyword',
      keyword: '联系人',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'联系人'关键词，取右侧值",
    },
    {
      field: 'receiverPhone',
      method: 'keyword',
      keyword: '联系电话',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'联系电话'关键词，取右侧值",
    },
    {
      field: 'receiverAddress',
      method: 'keyword',
      keyword: '收货地址',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货地址'关键词，取右侧值",
    },
  ],
  detail: {
    start_row: 4,
    end_condition: 'next_keyword:合计',
    columns: [
      { field: 'skuCode',     col: 1, post_process: 'keep',             description: 'B列物品编码' },
      { field: 'skuName',     col: 2, post_process: 'keep',             description: 'C列物品名称' },
      { field: 'skuSpec',     col: 3, post_process: 'keep',             description: 'D列规格型号' },
      { field: 'skuQuantity', col: 5, post_process: 'convert_to_number', description: 'F列出库数量' },
    ],
  },
  metadata: { generatedBy: 'manual', description: '多门店分Sheet出库单 - 每个Sheet对应一个门店，Sheet名即门店名' },
};

// 6. 黔寨寨PDF配送单（PDF → detail.method='pdf_table'）
const qianZhaiZhaiRule: RuleConfig = {
  file_type: 'pdf',
  multi_sheet: false,
  sheet_name_source: null,
  header: [
    {
      field: 'externalCode',
      method: 'keyword',
      keyword: '配送单号',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'配送单号'关键词，取右侧值作为外部编码",
    },
    {
      field: 'receiverName',
      method: 'keyword',
      keyword: '收货人',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货人'关键词，取右侧值",
    },
    {
      field: 'receiverPhone',
      method: 'keyword',
      keyword: '收货电话',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货电话'关键词，取右侧值",
    },
    {
      field: 'receiverAddress',
      method: 'keyword',
      keyword: '收货地址',
      direction: 'right',
      separator: '：',
      post_process: 'keep',
      description: "搜索'收货地址'关键词，取右侧值",
    },
  ],
  detail: {
    method: 'pdf_table',
    table_keyword: 'ZBWP',
    columns: [
      { field: 'skuCode',     col: 0, post_process: 'keep',             description: 'PDF表格第1列物品编码（ZBWP开头）' },
      { field: 'skuName',     col: 1, post_process: 'keep',             description: 'PDF表格第2列物品名称' },
      { field: 'skuSpec',     col: 2, post_process: 'keep',             description: 'PDF表格第3列规格型号' },
      { field: 'skuQuantity', col: 3, post_process: 'convert_to_number', description: 'PDF表格第4列发货数量' },
    ],
  },
  metadata: { generatedBy: 'manual', description: '黔寨寨PDF配送单 - PDF表格解析，关键词定位表头' },
};

// 导出所有预置规则
export const presetRules: { name: string; rule: RuleConfig }[] = [
  { name: '黎明屯配送发货单',   rule: liMingTunRule },
  { name: '湖南仓发货明细',     rule: huNanCangRule },
  { name: '欢乐牧场模板',       rule: huanLeMuChangRule },
  { name: '门店调拨单-卡片式',  rule: diaoBoDanRule },
  { name: '多门店分Sheet出库单', rule: multiSheetRule },
  { name: '黔寨寨PDF配送单',    rule: qianZhaiZhaiRule },
];
