import * as XLSX from 'xlsx';
import type { RawFileData, RawSheetData } from './index';

/**
 * 解析Excel文件为统一的RawFileData格式
 * 支持多Sheet、合并单元格处理
 */
export function parseExcel(buffer: Buffer): RawFileData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  const sheets: RawSheetData[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    const rows: (string | null)[][] = [];
    
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: (string | null)[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        row.push(cell ? String(cell.v ?? '') : null);
      }
      rows.push(row);
    }
    
    return { name, rows };
  });

  return { type: 'excel', sheets };
}
