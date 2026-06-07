import type { RawFileData } from './index';

/**
 * 解析PDF文件
 * 输出统一的 sheets[].rows[][] 结构（每页一个 sheet，按行列拆分）
 */
export async function parsePDF(buffer: Buffer): Promise<RawFileData> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);

  const text: string = data.text;

  // 按页拆分（PDF 用 \f 分页）
  const pages = text.split('\f').filter((p: string) => p.trim().length > 0);
  const pagesArr = pages.length > 0 ? pages : [text];

  // 将每页文本转为 rows[][]
  const sheets = pagesArr.map((pageText, i) => {
    const lines = pageText.split('\n').filter((l: string) => l.trim().length > 0);
    const rows: (string | null)[][] = lines.map((line: string) => {
      // 优先用 tab 拆列，fallback 到 2+ 空格
      if (line.includes('\t')) {
        return line.split('\t').map((cell: string) => cell.trim() || null);
      }
      return line.split(/\s{2,}/).map((cell: string) => cell.trim() || null);
    });
    return { name: `page${i + 1}`, rows };
  });

  return { type: 'pdf', sheets };
}
