import type { RawFileData } from './index';

/**
 * 解析PDF文件
 * 使用pdf-parse提取文本内容
 */
export async function parsePDF(buffer: Buffer): Promise<RawFileData> {
  // Polyfill DOMMatrix for Node.js (pdfjs-dist requires it)
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      is2D = true; isIdentity = true;
      constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = this.a; this.m12 = this.b;
          this.m21 = this.c; this.m22 = this.d;
          this.m41 = this.e; this.m42 = this.f;
        }
      }
      inverse() { return new DOMMatrix(); }
      multiply() { return new DOMMatrix(); }
      translate() { return new DOMMatrix(); }
      scale() { return new DOMMatrix(); }
      rotate() { return new DOMMatrix(); }
      transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
    } as unknown as typeof globalThis.DOMMatrix;
  }

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
