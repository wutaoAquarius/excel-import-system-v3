import type { RawFileData } from './index';

/**
 * 解析PDF文件
 * 使用pdf-parse v2 PDFParse类提取文本内容
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

  // pdf-parse v2 uses class-based API
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const text = result.text;

  // 尝试按页拆分（PDF通常用form feed \f 分页）
  const pages = text.split('\f').filter((p: string) => p.trim().length > 0);

  return {
    type: 'pdf',
    pages: pages.length > 0 ? pages : [text],
  };
}
