import type { RawFileData } from './index';

/**
 * 解析PDF文件
 * 使用pdf-parse提取文本内容
 */
export async function parsePDF(buffer: Buffer): Promise<RawFileData> {
  // 动态导入pdf-parse（仅在服务端使用）
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  
  // pdf-parse只返回全文，按页面分隔符拆分
  // 注意：pdf-parse默认用\n\n分页，但不保证精确
  // 对于我们的场景，直接用全文+行分割即可
  const text = data.text;
  
  // 尝试按页拆分（PDF通常用form feed \f 分页）
  const pages = text.split('\f').filter((p: string) => p.trim().length > 0);
  
  return {
    type: 'pdf',
    pages: pages.length > 0 ? pages : [text],
  };
}
