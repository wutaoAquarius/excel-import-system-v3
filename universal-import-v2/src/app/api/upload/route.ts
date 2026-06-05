import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    // 验证文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];
    const validExts = ['.xlsx', '.xls', '.pdf', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExts.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式: ${ext}，请上传 Excel/PDF/Word 文件` },
        { status: 400 }
      );
    }

    // 检查文件大小（50MB限制）
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大50MB），当前: ${(file.size / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      );
    }

    // 读取文件为buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 解析文件获取预览信息
    const { parseFile } = await import('@/lib/parsers');
    const rawData = await parseFile(buffer, file.name);

    // 返回文件信息和原始数据摘要
    const summary = {
      fileName: file.name,
      fileSize: file.size,
      fileType: ext.replace('.', ''),
      sheetsCount: rawData.sheets?.length || 0,
      sheetNames: rawData.sheets?.map((s) => s.name) || [],
      pagesCount: rawData.pages?.length || 0,
      rowsCount: rawData.sheets?.reduce((acc, s) => acc + s.rows.length, 0) || 0,
      // 返回前5行作为预览
      preview: rawData.sheets?.[0]?.rows.slice(0, 5) || [],
    };

    return NextResponse.json({
      data: {
        summary,
        rawData, // 完整原始数据，供后续解析使用
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '文件上传处理失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


