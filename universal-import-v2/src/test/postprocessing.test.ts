/**
 * 后处理步骤 + Sheet选择器测试
 * 覆盖：dedup去重、filterEmpty过滤、多Sheet合并
 */
import { describe, it, expect } from 'vitest';
import { executeRule } from '@/lib/rules/executor';
import type { RawFileData } from '@/lib/parsers';
import type { RuleConfig } from '@/lib/rules/config';

describe('后处理步骤', () => {
  describe('dedup - 去重', () => {
    it('应按指定字段去重', () => {
      const data: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['编码', '品名', '数量'],
            ['SKU001', '苹果', '10'],
            ['SKU001', '苹果(重复)', '5'],
            ['SKU002', '香蕉', '20'],
          ],
        }],
      };
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 } },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [{ type: 'dedup', by: 'skuCode' }],
      };
      const result = executeRule(data, rule);
      expect(result).toHaveLength(2);
      expect(result[0].skuName).toBe('苹果');
    });
  });

  describe('filterEmpty - 过滤空记录', () => {
    it('应过滤必填字段为空的记录', () => {
      const data: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['编码', '品名', '数量'],
            ['SKU001', '苹果', '10'],
            ['', '无编码商品', '5'],
            ['SKU002', '', '20'],
          ],
        }],
      };
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 } },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [{ type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] }],
      };
      const result = executeRule(data, rule);
      expect(result).toHaveLength(1);
      expect(result[0].skuCode).toBe('SKU001');
    });
  });
});

describe('Sheet选择器', () => {
  const multiSheetData: RawFileData = {
    type: 'excel',
    sheets: [
      { name: '门店A', rows: [['编码', '品名', '数量'], ['SKU001', '苹果', '10']] },
      { name: '门店B', rows: [['编码', '品名', '数量'], ['SKU002', '香蕉', '20']] },
      { name: '汇总', rows: [['编码', '品名', '数量'], ['SKU003', '橙子', '30']] },
    ],
  };

  const baseRule: RuleConfig = {
    fileType: 'excel',
    preprocessing: [],
    dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
    fieldMapping: [
      { target: 'skuCode', source: { type: 'column', index: 0 } },
      { target: 'skuName', source: { type: 'column', index: 1 } },
      { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
    ],
    postprocessing: [],
  };

  it('all - 所有Sheet合并', () => {
    const rule = { ...baseRule, sheets: { type: 'all' as const } };
    const result = executeRule(multiSheetData, rule);
    expect(result).toHaveLength(3);
  });

  it('active - 仅第一个Sheet', () => {
    const rule = { ...baseRule, sheets: { type: 'active' as const } };
    const result = executeRule(multiSheetData, rule);
    expect(result).toHaveLength(1);
    expect(result[0].skuCode).toBe('SKU001');
  });

  it('byIndex - 按索引选择', () => {
    const rule = { ...baseRule, sheets: { type: 'byIndex' as const, indices: [1, 2] } };
    const result = executeRule(multiSheetData, rule);
    expect(result).toHaveLength(2);
    expect(result[0].skuCode).toBe('SKU002');
    expect(result[1].skuCode).toBe('SKU003');
  });

  it('byName - 按名称选择', () => {
    const rule = { ...baseRule, sheets: { type: 'byName' as const, names: ['门店B'] } };
    const result = executeRule(multiSheetData, rule);
    expect(result).toHaveLength(1);
    expect(result[0].skuCode).toBe('SKU002');
  });
});
