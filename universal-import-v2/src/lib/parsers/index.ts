/**
 * 统一文件解析接口
 * 将 Excel/PDF 文件解析为统一的 sheets[].rows[][] 结构
 */

// 原始文件数据（解析后、规则执行前）
export interface RawSheetData {
  name: string;
  rows: (string | null)[][];
}

export interface RawFileData {
  type: 'excel' | 'pdf';
  sheets: RawSheetData[];
}

export { parseExcel } from './excel-parser';
export { parsePDF } from './pdf-parser';

/**
 * 统一入口：根据文件类型调用对应解析器
 */
export async function parseFile(
  buffer: Buffer | ArrayBuffer,
  fileName: string
): Promise<RawFileData> {
  const ext = fileName.toLowerCase().split('.').pop();
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;

  switch (ext) {
    case 'xlsx':
    case 'xls': {
      const { parseExcel } = await import('./excel-parser');
      return parseExcel(buf);
    }
    case 'pdf': {
      const { parsePDF } = await import('./pdf-parser');
      return parsePDF(buf);
    }
    default:
      throw new Error(`不支持的文件格式: .${ext}，仅支持 Excel(.xlsx/.xls) 和 PDF`);
  }
}
