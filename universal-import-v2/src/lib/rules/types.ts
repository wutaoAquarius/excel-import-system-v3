/**
 * 规则引擎 DSL 类型定义
 * 覆盖场景：头部跳过、尾部提取、跨行聚合、矩阵转置、多Sheet合并、卡片拆分、PDF文本解析
 */

// ===== 运单标准字段 =====
export type WaybillField =
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

// ===== 运单记录 =====
export interface WaybillRecord {
  externalCode?: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  skuCode: string;
  skuName: string;
  skuQuantity: number;
  skuSpec?: string;
  remark?: string;
}

// ===== Sheet选择器 =====
export type SheetSelector =
  | { type: 'all' }
  | { type: 'active' }
  | { type: 'byIndex'; indices: number[] }
  | { type: 'byName'; names: string[] };

// ===== 尾部字段提取配置 =====
export interface FooterField {
  target: WaybillField;
  row: number | 'auto';       // 行号或自动检测
  col: number;                // 列号(0-based)
  label?: string;             // 可选标签匹配（如"收货人"）
  labelCol?: number;          // 标签所在列
}
