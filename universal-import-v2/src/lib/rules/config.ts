import { WaybillField, FooterField, SheetSelector } from './types';

// ===== 预处理步骤 =====
export type PreprocessStep =
  | SkipRowsStep
  | ExtractFooterStep
  | CardSplitStep
  | FilterEmptyRowsStep;

export interface SkipRowsStep {
  type: 'skipRows';
  count: number;  // 跳过前N行
}

export interface ExtractFooterStep {
  type: 'extractFooter';
  startRow: number | 'afterData';  // 从哪行开始是footer
  fields: FooterField[];
}

export interface CardSplitStep {
  type: 'cardSplit';
  boundary: string;           // 边界标识文本
  matchMode: 'startsWith' | 'contains' | 'regex';
}

export interface FilterEmptyRowsStep {
  type: 'filterEmptyRows';
  minNonEmpty?: number;  // 至少N个非空单元格才保留
}

// ===== 数据提取模式 =====
export type DataExtractionConfig =
  | TableExtraction
  | MatrixExtraction
  | GroupedExtraction
  | TextExtraction
  | CardExtraction;

export interface TableExtraction {
  mode: 'table';
  headerRow: number;      // 表头行号(0-based)
  dataStartRow: number;   // 数据开始行
  dataEndRow?: number | 'auto';  // 数据结束行，auto=遇到空行或合计行停止
  endMarkers?: string[];  // 结束标志（如"合计"）
}

export interface MatrixExtraction {
  mode: 'matrix';
  headerRow: number;
  dataStartRow: number;
  pivotStartCol: number;    // 从哪列开始是转置列（门店列）
  pivotHeaderRow: number;   // 转置列头所在行
  pivotTargetField: WaybillField;  // 转置列头映射到哪个字段（如storeName）
  valueField: WaybillField;        // 格子值映射到哪个字段（如skuQuantity）
  skipZeroValues?: boolean;        // 跳过0值
}

export interface GroupedExtraction {
  mode: 'grouped';
  headerRow: number;
  dataStartRow: number;
  groupByCol: number;       // 按哪列分组（如配送单号列）
  sharedFields: FieldMapping[];  // 组内共享字段（如收货人信息）
}

export interface TextExtraction {
  mode: 'text';
  separator?: string;       // 记录分隔符（如"━━━"）
  linePatterns: LinePattern[];  // 每行匹配规则
}

export interface LinePattern {
  pattern: string;          // 正则表达式
  captures: { group: number; target: WaybillField }[];
}

export interface CardExtraction {
  mode: 'card';
  headerFields: CardHeaderField[];  // 卡片头部字段提取
  tableConfig: TableExtraction;     // 卡片内表格配置
}

export interface CardHeaderField {
  row: number;             // 卡片内相对行号
  col: number;
  target: WaybillField;
  labelCol?: number;       // 标签所在列（用于验证）
  label?: string;
}

// ===== 字段映射 =====
export interface FieldMapping {
  target: WaybillField;
  source: FieldSource;
  transform?: TransformStep[];
  confidence?: number;     // AI生成时的置信度 0-1
}

export type FieldSource =
  | { type: 'column'; index: number }            // 按列索引
  | { type: 'columnName'; name: string }         // 按列名
  | { type: 'fixed'; value: string }             // 固定值
  | { type: 'footer'; fieldIndex: number }       // 来自footer提取
  | { type: 'cardHeader'; fieldIndex: number }   // 来自卡片头
  | { type: 'regex'; pattern: string; group: number }  // 正则提取
  | { type: 'concat'; sources: FieldSource[]; separator?: string }; // 拼接

// ===== 转换步骤 =====
export type TransformStep =
  | { type: 'trim' }
  | { type: 'toNumber' }
  | { type: 'replace'; pattern: string; replacement: string }
  | { type: 'split'; separator: string; index: number }
  | { type: 'prefix'; value: string }
  | { type: 'suffix'; value: string }
  | { type: 'regex'; pattern: string; group: number };

// ===== 后处理步骤 =====
export type PostprocessStep =
  | { type: 'dedup'; by: WaybillField }
  | { type: 'filterEmpty'; requiredFields: WaybillField[] }
  | { type: 'mergeRows'; groupBy: WaybillField; mergeField: WaybillField; separator: string };

// ===== 完整规则配置 =====
export interface RuleConfig {
  fileType: 'excel' | 'pdf' | 'word';
  sheets?: SheetSelector;
  preprocessing: PreprocessStep[];
  dataExtraction: DataExtractionConfig;
  fieldMapping: FieldMapping[];
  postprocessing: PostprocessStep[];
  metadata?: {
    generatedBy?: 'ai' | 'manual';
    confidence?: number;
    description?: string;
  };
}
