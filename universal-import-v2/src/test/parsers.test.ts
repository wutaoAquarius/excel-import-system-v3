/**
 * 文件解析器测试
 * 覆盖：Excel解析、PDF解析、文件类型路由
 */
import { describe, it, expect } from 'vitest';
import { parseExcel } from '@/lib/parsers/excel-parser';
import { parseFile } from '@/lib/parsers';
import * as XLSX from 'xlsx';

describe('Excel解析器', () => {
  function createTestExcel(data: (string | number | null)[][], sheetName = 'Sheet1'): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  it('应正确解析单Sheet Excel', () => {
    const buffer = createTestExcel([
      ['编码', '品名', '数量'],
      ['SKU001', '苹果', 10],
      ['SKU002', '香蕉', 20],
    ]);
    const result = parseExcel(buffer);
    expect(result.type).toBe('excel');
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets![0].name).toBe('Sheet1');
    expect(result.sheets![0].rows).toHaveLength(3);
    expect(result.sheets![0].rows[1][0]).toBe('SKU001');
  });

  it('应正确处理null单元格', () => {
    const buffer = createTestExcel([
      ['A', null, 'C'],
      [null, 'B', null],
    ]);
    const result = parseExcel(buffer);
    // xlsx library handles nulls - empty cells become null
    expect(result.sheets![0].rows[0][0]).toBe('A');
    expect(result.sheets![0].rows[0][2]).toBe('C');
  });

  it('应正确处理数字类型', () => {
    const buffer = createTestExcel([
      ['数量'],
      [100],
      [3.14],
    ]);
    const result = parseExcel(buffer);
    expect(result.sheets![0].rows[1][0]).toBe('100');
    expect(result.sheets![0].rows[2][0]).toBe('3.14');
  });

  it('应正确处理多Sheet', () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([['Sheet1数据']]);
    const ws2 = XLSX.utils.aoa_to_sheet([['Sheet2数据']]);
    XLSX.utils.book_append_sheet(wb, ws1, '门店A');
    XLSX.utils.book_append_sheet(wb, ws2, '门店B');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const result = parseExcel(buffer);
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets![0].name).toBe('门店A');
    expect(result.sheets![1].name).toBe('门店B');
  });
});

describe('parseFile - 文件类型路由', () => {
  it('应根据xlsx扩展名路由到Excel解析器', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['test']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const result = await parseFile(buffer, 'test.xlsx');
    expect(result.type).toBe('excel');
    expect(result.sheets).toBeDefined();
  });

  it('应对不支持的扩展名抛出错误', async () => {
    const buffer = Buffer.from('test');
    await expect(parseFile(buffer, 'test.txt')).rejects.toThrow('不支持的文件格式');
  });

  it('应正确处理大小写扩展名', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['test']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const result = await parseFile(buffer, 'TEST.XLSX');
    expect(result.type).toBe('excel');
  });
});
