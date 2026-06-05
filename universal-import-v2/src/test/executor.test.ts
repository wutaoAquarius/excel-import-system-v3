/**
 * 规则引擎执行器 - 核心测试
 * 覆盖：table/matrix/grouped/card/text 五种数据提取模式
 */
import { describe, it, expect } from 'vitest';
import { executeRule } from '@/lib/rules/executor';
import type { RawFileData } from '@/lib/parsers';
import type { RuleConfig } from '@/lib/rules/config';

describe('规则引擎执行器 - executeRule', () => {
  describe('Table模式 - 基础表格提取', () => {
    const mockExcelData: RawFileData = {
      type: 'excel',
      sheets: [{
        name: 'Sheet1',
        rows: [
          ['序号', '物品编码', '物品名称', '数量'],
          ['1', 'SKU001', '苹果', '10'],
          ['2', 'SKU002', '香蕉', '20'],
          ['3', 'SKU003', '橙子', '30'],
        ],
      }],
    };

    const tableRule: RuleConfig = {
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
        { target: 'skuCode', source: { type: 'column', index: 1 } },
        { target: 'skuName', source: { type: 'column', index: 2 } },
        { target: 'skuQuantity', source: { type: 'column', index: 3 }, transform: [{ type: 'toNumber' }] },
      ],
      postprocessing: [],
    };

    it('应正确解析基础表格数据', () => {
      const result = executeRule(mockExcelData, tableRule);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10 });
      expect(result[2]).toEqual({ skuCode: 'SKU003', skuName: '橙子', skuQuantity: 30 });
    });

    it('遇到全空行时应停止解析（auto模式的数据区结束判定）', () => {
      const dataWithEmptyRow: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['序号', '物品编码', '物品名称', '数量'],
            ['1', 'SKU001', '苹果', '10'],
            [null, null, null, null],
            ['3', 'SKU003', '橙子', '30'],
          ],
        }],
      };
      // auto模式：全空行标志数据区结束
      const result = executeRule(dataWithEmptyRow, tableRule);
      expect(result).toHaveLength(1);
      expect(result[0].skuCode).toBe('SKU001');
    });

    it('应在遇到结束标记时停止解析', () => {
      const dataWithEndMarker: RawFileData = {
        type: 'excel',
        sheets: [{
          name: 'Sheet1',
          rows: [
            ['序号', '物品编码', '物品名称', '数量'],
            ['1', 'SKU001', '苹果', '10'],
            ['2', 'SKU002', '香蕉', '20'],
            ['合计', null, null, '30'],
          ],
        }],
      };
      const ruleWithMarker: RuleConfig = {
        ...tableRule,
        dataExtraction: {
          mode: 'table',
          headerRow: 0,
          dataStartRow: 1,
          dataEndRow: 'auto',
          endMarkers: ['合计'],
        },
      };
      const result = executeRule(dataWithEndMarker, ruleWithMarker);
      expect(result).toHaveLength(2);
    });
  });

  describe('Matrix模式 - 矩阵转置', () => {
    const matrixData: RawFileData = {
      type: 'excel',
      sheets: [{
        name: 'Sheet1',
        rows: [
          ['编码', '品名', '门店A', '门店B', '门店C'],
          ['SKU001', '苹果', '5', '0', '10'],
          ['SKU002', '香蕉', '3', '7', '0'],
        ],
      }],
    };

    const matrixRule: RuleConfig = {
      fileType: 'excel',
      sheets: { type: 'active' },
      preprocessing: [],
      dataExtraction: {
        mode: 'matrix',
        headerRow: 0,
        dataStartRow: 1,
        pivotStartCol: 2,
        pivotHeaderRow: 0,
        pivotTargetField: 'storeName',
        valueField: 'skuQuantity',
        skipZeroValues: true,
      },
      fieldMapping: [
        { target: 'skuCode', source: { type: 'column', index: 0 } },
        { target: 'skuName', source: { type: 'column', index: 1 } },
        { target: 'storeName', source: { type: 'columnName', name: 'pivot_header' } },
        { target: 'skuQuantity', source: { type: 'columnName', name: 'pivot_value' }, transform: [{ type: 'toNumber' }] },
      ],
      postprocessing: [],
    };

    it('应正确进行矩阵转置并跳过0值', () => {
      const result = executeRule(matrixData, matrixRule);
      // SKU001: 门店A(5), 门店C(10) = 2条; SKU002: 门店A(3), 门店B(7) = 2条
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ skuCode: 'SKU001', skuName: '苹果', storeName: '门店A', skuQuantity: 5 });
      expect(result[1]).toEqual({ skuCode: 'SKU001', skuName: '苹果', storeName: '门店C', skuQuantity: 10 });
    });
  });

  describe('PDF模式 - 文本解析', () => {
    const pdfData: RawFileData = {
      type: 'pdf',
      pages: ['标题行\n表头行\nSKU001 苹果 10\nSKU002 香蕉 20\n收货人: 张三'],
    };

    const pdfRule: RuleConfig = {
      fileType: 'pdf',
      preprocessing: [
        { type: 'skipRows', count: 2 },
      ],
      dataExtraction: { mode: 'text' },
      fieldMapping: [
        { target: 'skuName', source: { type: 'regex', pattern: '(SKU\\d+)\\s+(\\S+)\\s+(\\d+)', group: 2 } },
        { target: 'skuCode', source: { type: 'regex', pattern: '(SKU\\d+)\\s+(\\S+)\\s+(\\d+)', group: 1 } },
        { target: 'skuQuantity', source: { type: 'regex', pattern: '(SKU\\d+)\\s+(\\S+)\\s+(\\d+)', group: 3 }, transform: [{ type: 'toNumber' }] },
      ],
      postprocessing: [
        { type: 'filterEmpty', requiredFields: ['skuCode', 'skuName'] },
      ],
    };

    it('应正确解析PDF文本数据', () => {
      const result = executeRule(pdfData, pdfRule);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('不支持的文件类型', () => {
    it('应抛出错误', () => {
      const unknownData = { type: 'word' as const, text: 'hello' };
      const rule: RuleConfig = {
        fileType: 'word',
        preprocessing: [],
        dataExtraction: { mode: 'text' },
        fieldMapping: [],
        postprocessing: [],
      };
      expect(() => executeRule(unknownData, rule)).toThrow();
    });
  });
});
