/**
 * 预处理步骤测试
 * 覆盖：skipRows, extractFooter, filterEmptyRows
 */
import { describe, it, expect } from 'vitest';
import { executeRule } from '@/lib/rules/executor';
import type { RawFileData } from '@/lib/parsers';
import type { RuleConfig } from '@/lib/rules/config';

describe('预处理步骤', () => {
  describe('skipRows - 跳过前N行', () => {
    it('应正确跳过指定行数', () => {
      const data: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['公司名称：XXX物流'],
            ['日期：2024-01-01'],
            ['空行'],
            ['编码', '品名', '数量'],
            ['SKU001', '苹果', '10'],
          ],
        }],
      };
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [{ type: 'skipRows', count: 3 }],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 } },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(data, rule);
      expect(result).toHaveLength(1);
      expect(result[0].skuCode).toBe('SKU001');
    });
  });

  describe('extractFooter - 尾部信息提取', () => {
    it('应从尾部提取收货人信息并应用到所有记录', () => {
      const data: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['编码', '品名', '数量', null, null],
            ['SKU001', '苹果', '10', null, null],
            ['SKU002', '香蕉', '20', null, null],
            ['收货人', '张三', null, '电话', '13800138000'],
          ],
        }],
      };
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [
          {
            type: 'extractFooter',
            startRow: 3,
            fields: [
              { target: 'receiverName', row: 3, col: 1 },
              { target: 'receiverPhone', row: 3, col: 4 },
            ],
          },
        ],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1, dataEndRow: 'auto' },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 } },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
          { target: 'receiverName', source: { type: 'footer', fieldIndex: 0 } },
          { target: 'receiverPhone', source: { type: 'footer', fieldIndex: 1 } },
        ],
        postprocessing: [],
      };
      const result = executeRule(data, rule);
      expect(result).toHaveLength(2);
      expect(result[0].receiverName).toBe('张三');
      expect(result[0].receiverPhone).toBe('13800138000');
      expect(result[1].receiverName).toBe('张三');
    });
  });

  describe('filterEmptyRows - 过滤空行', () => {
    it('应过滤非空单元格数量不足的行', () => {
      const data: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['编码', '品名', '数量'],
            ['SKU001', '苹果', '10'],
            ['', null, ''],
            ['SKU002', '香蕉', '20'],
          ],
        }],
      };
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [{ type: 'filterEmptyRows', minNonEmpty: 2 }],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1, dataEndRow: 'auto' },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 } },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(data, rule);
      expect(result).toHaveLength(2);
    });
  });
});
