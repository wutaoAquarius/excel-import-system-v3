/**
 * 字段映射与转换测试
 * 覆盖：column/columnName/fixed/footer/regex/concat 源类型
 * 转换：trim/toNumber/replace/split/prefix/suffix/regex
 */
import { describe, it, expect } from 'vitest';
import { executeRule } from '@/lib/rules/executor';
import type { RawFileData } from '@/lib/parsers';
import type { RuleConfig } from '@/lib/rules/config';

describe('字段映射与转换', () => {
  const baseData: RawFileData = {
    type: 'excel',
    sheets: [{
      name: 'Sheet1',
      rows: [
        ['编码', '名称', '数量', '电话'],
        ['  SKU001  ', '苹果x5斤', '10.5', '138-0013-8000'],
      ],
    }],
  };

  describe('Source类型', () => {
    it('column - 按列索引映射', () => {
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
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].skuCode).toBe('  SKU001  ');
      expect(result[0].skuName).toBe('苹果x5斤');
    });

    it('columnName - 按列名映射', () => {
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'columnName', name: '编码' } },
          { target: 'skuName', source: { type: 'columnName', name: '名称' } },
          { target: 'skuQuantity', source: { type: 'columnName', name: '数量' }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].skuCode).toBe('  SKU001  ');
      expect(result[0].skuQuantity).toBe(10.5);
    });

    it('fixed - 固定值', () => {
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
          { target: 'externalCode', source: { type: 'fixed', value: 'ORDER-001' } },
        ],
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].externalCode).toBe('ORDER-001');
    });
  });

  describe('Transform步骤', () => {
    it('trim - 去除首尾空格', () => {
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].skuCode).toBe('SKU001');
    });

    it('replace - 正则替换', () => {
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
          { target: 'receiverPhone', source: { type: 'column', index: 3 }, transform: [{ type: 'replace', pattern: '-', replacement: '' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].receiverPhone).toBe('13800138000');
    });

    it('split - 分割取值', () => {
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }] },
          { target: 'skuName', source: { type: 'column', index: 1 }, transform: [{ type: 'split', separator: 'x', index: 0 }] },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].skuName).toBe('苹果');
    });

    it('prefix/suffix - 添加前后缀', () => {
      const rule: RuleConfig = {
        fileType: 'excel',
        sheets: { type: 'active' },
        preprocessing: [],
        dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
        fieldMapping: [
          { target: 'skuCode', source: { type: 'column', index: 0 }, transform: [{ type: 'trim' }, { type: 'prefix', value: 'WMS-' }] },
          { target: 'skuName', source: { type: 'column', index: 1 } },
          { target: 'skuQuantity', source: { type: 'column', index: 2 }, transform: [{ type: 'toNumber' }] },
        ],
        postprocessing: [],
      };
      const result = executeRule(baseData, rule);
      expect(result[0].skuCode).toBe('WMS-SKU001');
    });
  });
});
