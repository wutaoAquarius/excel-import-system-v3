/**
 * 统一规则引擎执行器
 * 根据 RuleConfig 从 RawFileData 提取 WaybillRecord[]
 */
import type { RawFileData, RawSheetData } from '@/lib/parsers';
import type { RuleConfig, HeaderField, DetailConfig, DetailColumn } from './config';
import type { WaybillRecord } from './types';

export function executeRule(rawData: RawFileData, rule: RuleConfig): WaybillRecord[] {
  const sheets = rule.multi_sheet ? rawData.sheets : rawData.sheets.slice(0, 1);
  const allResults: WaybillRecord[] = [];

  for (const sheet of sheets) {
    const results = processSheet(sheet, rule);
    allResults.push(...results);
  }
  return allResults;
}

function processSheet(sheet: RawSheetData, rule: RuleConfig): WaybillRecord[] {
  const rows = sheet.rows;
  if (rows.length === 0) return [];

  // 卡片分隔模式：优先处理
  if (rule.detail.block_separator) {
    return processBlocks(rows, sheet.name, rule);
  }

  // 提取 header 字段
  const headerData = extractHeader(rows, sheet.name, rule.header);

  // 定位明细数据行
  const dataRows = getDetailRows(rows, rule.detail);

  // 矩阵转置
  if (rule.detail.pivot) {
    return executePivot(rows, dataRows, headerData, rule.detail);
  }

  // 普通列提取
  const records = extractColumns(dataRows, rule.detail.columns);

  // 分组聚合
  if (rule.detail.group_by) {
    return groupRecords(records, headerData, rule.detail.group_by);
  }

  // 普通模式
  return records.map((r) => ({ ...headerData, ...r }) as unknown as WaybillRecord);
}

// ===== Header 提取 =====
function extractHeader(
  rows: (string | null)[][],
  sheetName: string,
  headerFields: HeaderField[]
): Record<string, string | number | null> {
  const data: Record<string, string | number | null> = {};
  for (const field of headerFields) {
    let value: string | null = null;
    switch (field.method) {
      case 'cell':
        value = rows[field.row ?? 0]?.[field.col ?? 0] ?? null;
        break;
      case 'sheet_name':
        value = sheetName;
        break;
      case 'keyword':
        value = findByKeyword(rows, field);
        break;
    }
    data[field.field] = applyPostProcess(value, field.post_process);
  }
  return data;
}

function findByKeyword(rows: (string | null)[][], field: HeaderField): string | null {
  const kw = field.keyword ?? '';
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || !cell.includes(kw)) continue;

      if (field.direction === 'below') {
        // 有 separator 时先尝试同单元格 split
        if (field.separator) {
          const parts = cell.split(field.separator);
          const last = parts[parts.length - 1].trim();
          if (last) return last;
        }
        // fallback: 下一行同列
        return rows[r + 1]?.[c] ?? null;
      }
      // direction=right（默认）
      if (field.separator) {
        const parts = cell.split(field.separator);
        const last = parts[parts.length - 1].trim();
        if (last) return last;
      }
      // fallback: 右一格
      return row[c + 1] ?? null;
    }
  }
  return null;
}

// ===== 明细行定位 =====
function getDetailRows(rows: (string | null)[][], detail: DetailConfig): (string | null)[][] {
  const startRow = detail.start_row ?? 0;
  const result: (string | null)[][] = [];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (detail.end_condition) {
      if (detail.end_condition === 'blank_row') {
        if (row.every((cell) => !cell || cell.trim() === '')) break;
      } else if (detail.end_condition.startsWith('next_keyword:')) {
        const keyword = detail.end_condition.replace('next_keyword:', '');
        if (row.some((cell) => cell && cell.includes(keyword))) break;
      }
    }
    result.push(row);
  }
  return result;
}

// ===== 列提取 =====
function extractColumns(
  dataRows: (string | null)[][],
  columns: DetailColumn[]
): Record<string, string | number | null>[] {
  const records: Record<string, string | number | null>[] = [];
  for (const row of dataRows) {
    const record: Record<string, string | number | null> = {};
    let hasData = false;
    for (const col of columns) {
      const raw = row[col.col] ?? null;
      const value = applyPostProcess(raw, col.post_process);
      if (value !== null && value !== '') hasData = true;
      record[col.field] = value;
    }
    if (hasData) records.push(record);
  }
  return records;
}

// ===== 矩阵转置 =====
function executePivot(
  allRows: (string | null)[][],
  dataRows: (string | null)[][],
  headerData: Record<string, string | number | null>,
  detail: DetailConfig
): WaybillRecord[] {
  const pivot = detail.pivot!;
  const headerRow = allRows[0] ?? [];
  const results: WaybillRecord[] = [];

  const startCol = pivot.pivot_start_col;
  const endCol = pivot.pivot_end_col ?? headerRow.length - 1;
  const excludeCols = new Set(pivot.exclude_cols ?? []);
  const excludePatterns = pivot.exclude_patterns ?? [];

  // 构建有效 pivot 列
  const pivotCols: { index: number; name: string }[] = [];
  for (let c = startCol; c <= endCol; c++) {
    if (excludeCols.has(c)) continue;
    const colName = headerRow[c] ?? '';
    if (excludePatterns.some((p) => colName.includes(p))) continue;
    if (colName.trim()) pivotCols.push({ index: c, name: colName.trim() });
  }

  for (const row of dataRows) {
    for (const pc of pivotCols) {
      const cellValue = row[pc.index];
      if (pivot.skip_zero_values) {
        if (!cellValue || cellValue === '0' || cellValue.trim() === '') continue;
      }
      const record: Record<string, string | number | null> = { ...headerData };
      record[pivot.pivot_target_field] = pc.name;
      record[pivot.value_field] = toNumber(cellValue);
      for (const col of detail.columns) {
        record[col.field] = applyPostProcess(row[col.col], col.post_process);
      }
      results.push(record as unknown as WaybillRecord);
    }
  }
  return results;
}

// ===== 卡片分隔 =====
function processBlocks(
  rows: (string | null)[][],
  sheetName: string,
  rule: RuleConfig
): WaybillRecord[] {
  const separator = rule.detail.block_separator!;
  const blocks: (string | null)[][][] = [];
  let current: (string | null)[][] = [];

  for (const row of rows) {
    const joined = row.filter(Boolean).join(' ');
    if (joined.includes(separator)) {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(row);
    }
  }
  if (current.length > 0) blocks.push(current);

  const results: WaybillRecord[] = [];
  for (const block of blocks) {
    const blockHeader = extractHeader(block, sheetName, rule.header);
    const dataRows = getDetailRows(block, rule.detail);
    const records = extractColumns(dataRows, rule.detail.columns);
    for (const r of records) {
      results.push({ ...blockHeader, ...r } as unknown as WaybillRecord);
    }
  }
  return results;
}

// ===== 分组聚合 =====
function groupRecords(
  records: Record<string, string | number | null>[],
  headerData: Record<string, string | number | null>,
  groupByField: string
): WaybillRecord[] {
  const groups = new Map<string, Record<string, string | number | null>[]>();
  for (const r of records) {
    const key = String(r[groupByField] ?? 'unknown');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const results: WaybillRecord[] = [];
  for (const [, groupRows] of groups) {
    const shared = { ...headerData };
    const first = groupRows[0];
    if (first) {
      for (const key of ['storeName', 'receiverName', 'receiverPhone', 'receiverAddress', 'externalCode']) {
        if (first[key] !== null && first[key] !== undefined) {
          shared[key] = first[key];
        }
      }
    }
    for (const r of groupRows) {
      results.push({ ...shared, ...r } as unknown as WaybillRecord);
    }
  }
  return results;
}

// ===== 后处理工具 =====
function applyPostProcess(value: string | null | undefined, process: string): string | number | null {
  const str = (value ?? '').trim();
  if (!process || process === 'keep') return str || null;
  if (process === 'trim') return str || null;
  if (process === 'convert_to_number') return toNumber(str);
  if (process.startsWith('extract_code:')) {
    const pattern = process.replace('extract_code:', '').trim();
    try {
      const match = str.match(new RegExp(pattern));
      return match ? match[0] : str || null;
    } catch {
      return str || null;
    }
  }
  return str || null;
}

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
