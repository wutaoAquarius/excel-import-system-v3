/**
 * 规则引擎基础类型
 */

// 重新导出核心类型（从 config.ts 统一管理）
export type { TargetField, PostProcess, RuleConfig, HeaderField, DetailConfig, DetailColumn, PivotConfig } from './config';

// ===== 运单记录（解析最终输出） =====
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

// 保留 WaybillField 兼容性别名
export type { TargetField as WaybillField } from './config';
