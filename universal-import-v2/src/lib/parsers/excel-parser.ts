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

    // 处理合并单元格 - 将主单元格的值填充到合并区域的所有格子
    const merges = worksheet['!merges'] || [];
    for (const merge of merges) {
      const mainCell = worksheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
      const mainValue = mainCell ? String(mainCell.v ?? '') : null;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue; // 跳过主格本身
          if (r - range.s.r >= 0 && r - range.s.r < rows.length) {
            rows[r - range.s.r][c - range.s.c] = mainValue;
          }
        }
      }
    }
    
    return { name, rows };
  });

  return { type: 'excel', sheets };
}
