import type { RawFileData } from './index';

/**
 * 解析Word(.docx)文件为统一的RawFileData格式
 * 使用mammoth库提取纯文本内容
 */
export async function parseWord(buffer: Buffer): Promise<RawFileData> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const text: string = result.value;
  // 按行拆分为页面数据（Word没有分页概念，整体作为一页）
  return { type: 'word', text };
}
