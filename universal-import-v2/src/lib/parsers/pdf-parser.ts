import type { RawFileData } from './index';

/**
 * 解析PDF文件
 * 使用pdf-parse v1提取文本内容
 */
export async function parsePDF(buffer: Buffer): Promise<RawFileData> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);

  const text: string = data.text;

  // 尝试按页拆分（PDF通常用form feed \f 分页）
  const pages = text.split('\f').filter((p: string) => p.trim().length > 0);

  return {
    type: 'pdf',
    pages: pages.length > 0 ? pages : [text],
  };
}
