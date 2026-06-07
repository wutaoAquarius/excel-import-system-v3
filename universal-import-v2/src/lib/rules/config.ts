/**
 * 统一规则配置 Schema
 * 覆盖场景：平铺表格、头尾分离、矩阵转置、卡片分隔、分组聚合、PDF表格、多Sheet
 */

// ===== 目标字段（英文 key，UI 层用 FIELD_LABELS 映射中文） =====
export type TargetField =
  | 'externalCode'    // 外部编码
  | 'storeName'       // 收货门店
  | 'receiverName'    // 收件人姓名
  | 'receiverPhone'   // 收件人电话
  | 'receiverAddress' // 收件人地址
  | 'skuCode'         // SKU物品编码
  | 'skuName'         // SKU物品名称
  | 'skuQuantity'     // SKU发货数量
  | 'skuSpec'         // SKU规格型号
  | 'remark';         // 备注

// ===== 后处理类型 =====
// 'keep' | 'trim' | 'convert_to_number' | 'extract_code: 正则'
export type PostProcess = string;

// ===== 头部字段提取规则 =====
export interface HeaderField {
  field: TargetField;
  method: 'keyword' | 'cell' | 'sheet_name';
  keyword?: string;            // method=keyword 时的搜索关键词
  direction?: 'right' | 'below';
  separator?: string;          // 分隔符
  row?: number;                // method=cell 时的行号(0-based)
  col?: number;                // method=cell 时的列号(0-based)
  post_process: PostProcess;
  description?: string;        // AI生成的提取说明
}

// ===== 矩阵转置配置 =====
export interface PivotConfig {
  pivot_start_col: number;
  pivot_end_col?: number;
  exclude_cols?: number[];
  exclude_patterns?: string[];       // 按列头关键词排除
  pivot_target_field: TargetField;   // 列头映射到哪个字段
  value_field: TargetField;          // 格子值映射到哪个字段
  skip_zero_values: boolean;
}

// ===== 明细列映射 =====
export interface DetailColumn {
  field: TargetField | string;  // 标准字段或辅助字段(如"配送单号")
  col: number;                  // 列号(0-based)
  post_process: PostProcess;
  description?: string;         // AI生成的提取说明
}

// ===== 明细表格配置 =====
export interface DetailConfig {
  // Excel 通用
  start_row?: number;          // 数据起始行号(0-based)
  end_condition?: string;      // 'blank_row' | 'next_keyword:合计'

  // PDF 专用
  method?: 'pdf_table';
  table_keyword?: string;      // 定位表头行的关键词
  table_bbox?: [number, number, number, number]; // [x0, y0, x1, y1]

  // 卡片分隔
  block_separator?: string;    // 卡片边界标识文本

  // 分组聚合
  group_by?: string;           // 按哪个字段分组

  // 矩阵转置
  pivot?: PivotConfig;

  // 列映射
  columns: DetailColumn[];
}

// ===== 完整规则配置 =====
export interface RuleConfig {
  file_type: 'excel' | 'pdf';
  multi_sheet: boolean;
  sheet_name_source?: 'sheet_name' | 'cell' | 'keyword' | null;
  header: HeaderField[];
  detail: DetailConfig;
  metadata?: {
    generatedBy?: 'ai' | 'manual';
    description?: string;
  };
}

// ===== 前端字段中英映射 =====
export const FIELD_LABELS: Record<TargetField, string> = {
  externalCode: '外部编码',
  storeName: '收货门店',
  receiverName: '收件人姓名',
  receiverPhone: '收件人电话',
  receiverAddress: '收件人地址',
  skuCode: 'SKU物品编码',
  skuName: 'SKU物品名称',
  skuQuantity: 'SKU发货数量',
  skuSpec: 'SKU规格型号',
  remark: '备注',
};

export const TARGET_FIELDS: TargetField[] = [
  'externalCode', 'storeName',
  'receiverName', 'receiverPhone', 'receiverAddress',
  'skuCode', 'skuName', 'skuQuantity', 'skuSpec', 'remark',
];
