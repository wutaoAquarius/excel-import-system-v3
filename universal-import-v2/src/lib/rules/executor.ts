/**
 * 规则引擎核心执行器
 * 根据RuleConfig解析RawFileData为WaybillRecord[]
 */
import type { RawFileData, RawSheetData } from '@/lib/parsers';
import type { WaybillRecord, WaybillField } from './types';
import type {
  RuleConfig,
  PreprocessStep,
  DataExtractionConfig,
  FieldMapping,
  FieldSource,
  TransformStep,
  PostprocessStep,
  TableExtraction,
  MatrixExtraction,
  GroupedExtraction,
  CardExtraction,
} from './config';

export function executeRule(rawData: RawFileData, rule: RuleConfig): WaybillRecord[] {
  if (rawData.type === 'excel' && rawData.sheets) {
    return executeExcelRule(rawData.sheets, rule);
  }
  if (rawData.type === 'pdf' && rawData.pages) {
    return executePdfRule(rawData.pages, rule);
  }
  throw new Error(`不支持的文件类型: ${rawData.type}`);
}

function executeExcelRule(sheets: RawSheetData[], rule: RuleConfig): WaybillRecord[] {
  // 选择要处理的sheets
  const selectedSheets = selectSheets(sheets, rule.sheets);
  const allRecords: WaybillRecord[] = [];

  for (const sheet of selectedSheets) {
    let rows = [...sheet.rows];
    let footerData: Record<string, string> = {};

    // 预处理
    for (const step of rule.preprocessing) {
      const result = applyPreprocess(rows, step);
      rows = result.rows;
      if (result.footerData) {
        footerData = { ...footerData, ...result.footerData };
      }
    }

    // 数据提取
    const extracted = extractData(rows, rule.dataExtraction);

    // 字段映射
    const records = extracted.map((row) =>
      mapFields(row, rule.fieldMapping, footerData)
    );

    allRecords.push(...records);
  }

  // 后处理
  return applyPostprocess(allRecords, rule.postprocessing);
}

function executePdfRule(pages: string[], rule: RuleConfig): WaybillRecord[] {
  // PDF: 将所有页面文本合并，按行分割作为rows
  const allText = pages.join('\n');
  const lines = allText.split('\n');
  const rows: (string | null)[][] = lines.map((line) => [line]);

  let processedRows = [...rows];
  let footerData: Record<string, string> = {};

  for (const step of rule.preprocessing) {
    const result = applyPreprocess(processedRows, step);
    processedRows = result.rows;
    if (result.footerData) {
      footerData = { ...footerData, ...result.footerData };
    }
  }

  const extracted = extractData(processedRows, rule.dataExtraction);
  const records = extracted.map((row) =>
    mapFields(row, rule.fieldMapping, footerData)
  );

  return applyPostprocess(records, rule.postprocessing);
}

// ===== Sheet选择 =====
function selectSheets(sheets: RawSheetData[], selector?: import('./types').SheetSelector): RawSheetData[] {
  if (!selector) return sheets;
  switch (selector.type) {
    case 'all': return sheets;
    case 'active': return sheets.length > 0 ? [sheets[0]] : [];
    case 'byIndex': return selector.indices.map((i) => sheets[i]).filter(Boolean);
    case 'byName': return sheets.filter((s) => selector.names.includes(s.name));
  }
}

// ===== 预处理 =====
interface PreprocessResult {
  rows: (string | null)[][];
  footerData?: Record<string, string>;
}

function applyPreprocess(rows: (string | null)[][], step: PreprocessStep): PreprocessResult {
  switch (step.type) {
    case 'skipRows':
      return { rows: rows.slice(step.count) };

    case 'extractFooter': {
      const startRow = step.startRow === 'afterData'
        ? findDataEnd(rows)
        : step.startRow;
      const footerData: Record<string, string> = {};
      for (const field of step.fields) {
        const row = field.row === 'auto' ? startRow : field.row;
        if (row < rows.length) {
          const value = rows[row]?.[field.col];
          if (value) {
            footerData[field.target] = value.trim();
          }
        }
      }
      // 移除footer行
      return { rows: rows.slice(0, startRow), footerData };
    }

    case 'cardSplit':
      // cardSplit在extractData中处理
      return { rows };

    case 'filterEmptyRows': {
      const minNonEmpty = step.minNonEmpty ?? 1;
      const filtered = rows.filter((row) =>
        row.filter((cell) => cell && cell.trim()).length >= minNonEmpty
      );
      return { rows: filtered };
    }
  }
}

function findDataEnd(rows: (string | null)[][]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const nonEmpty = rows[i].filter((c) => c && c.trim()).length;
    if (nonEmpty >= 3) return i + 1;
  }
  return rows.length;
}

// ===== 数据提取 =====
type ExtractedRow = Record<string, string | null>;

function extractData(rows: (string | null)[][], config: DataExtractionConfig): ExtractedRow[] {
  switch (config.mode) {
    case 'table': return extractTable(rows, config);
    case 'matrix': return extractMatrix(rows, config);
    case 'grouped': return extractGrouped(rows, config);
    case 'card': return extractCard(rows, config);
    case 'text': return extractText(rows);
    default: return [];
  }
}

function extractTable(rows: (string | null)[][], config: TableExtraction): ExtractedRow[] {
  const headers = rows[config.headerRow]?.map((h) => h?.trim() || '') || [];
  let endRow = rows.length;

  if (config.dataEndRow === 'auto') {
    for (let i = config.dataStartRow; i < rows.length; i++) {
      const firstCell = rows[i]?.[0]?.trim() || '';
      if (config.endMarkers?.some((m) => firstCell.includes(m))) {
        endRow = i;
        break;
      }
      if (rows[i].every((c) => !c || !c.trim())) {
        endRow = i;
        break;
      }
    }
  } else if (typeof config.dataEndRow === 'number') {
    endRow = config.dataEndRow;
  }

  const result: ExtractedRow[] = [];
  for (let i = config.dataStartRow; i < endRow; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;
    const record: ExtractedRow = {};
    headers.forEach((h, idx) => {
      record[`col_${idx}`] = row[idx] ?? null;
      if (h) record[`name_${h}`] = row[idx] ?? null;
    });
    result.push(record);
  }
  return result;
}

function extractMatrix(rows: (string | null)[][], config: MatrixExtraction): ExtractedRow[] {
  const pivotHeaders = rows[config.pivotHeaderRow]?.slice(config.pivotStartCol) || [];
  const result: ExtractedRow[] = [];

  for (let i = config.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;

    for (let p = 0; p < pivotHeaders.length; p++) {
      const colIdx = config.pivotStartCol + p;
      const value = row[colIdx]?.trim();
      if (!value || value === '0' || value === '') {
        if (config.skipZeroValues) continue;
        if (!value) continue;
      }

      const record: ExtractedRow = {};
      // 固定列（SKU信息）
      for (let c = 0; c < config.pivotStartCol; c++) {
        record[`col_${c}`] = row[c] ?? null;
      }
      // 转置列头作为目标字段
      record[`pivot_header`] = pivotHeaders[p] ?? null;
      record[`pivot_value`] = value;
      result.push(record);
    }
  }
  return result;
}

function extractGrouped(rows: (string | null)[][], config: GroupedExtraction): ExtractedRow[] {
  const headers = rows[config.headerRow]?.map((h) => h?.trim() || '') || [];
  const result: ExtractedRow[] = [];

  for (let i = config.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;
    const record: ExtractedRow = {};
    headers.forEach((h, idx) => {
      record[`col_${idx}`] = row[idx] ?? null;
      if (h) record[`name_${h}`] = row[idx] ?? null;
    });
    result.push(record);
  }
  return result;
}

function extractCard(rows: (string | null)[][], config: CardExtraction): ExtractedRow[] {
  // 找到所有卡片的起始行（通过preprocessing cardSplit已标记）
  // 这里假设rows已经是单个卡片的内容
  const result: ExtractedRow[] = [];
  const cardHeaderData: Record<string, string> = {};

  for (const field of config.headerFields) {
    if (field.row < rows.length) {
      const value = rows[field.row]?.[field.col];
      if (value) cardHeaderData[field.target] = value.trim();
    }
  }

  const tableRows = extractTable(rows, config.tableConfig);
  for (const row of tableRows) {
    // 合并卡片头信息
    for (const [key, val] of Object.entries(cardHeaderData)) {
      row[`card_${key}`] = val;
    }
    result.push(row);
  }
  return result;
}

function extractText(rows: (string | null)[][]): ExtractedRow[] {
  // 文本模式：每行作为一条记录的原始文本
  return rows.map((row) => ({ raw_text: row[0] ?? null }));
}

// ===== 字段映射 =====
function mapFields(
  row: ExtractedRow,
  mappings: FieldMapping[],
  footerData: Record<string, string>
): WaybillRecord {
  const record: Partial<WaybillRecord> = {};

  for (const mapping of mappings) {
    let value = resolveSource(row, mapping.source, footerData);
    if (value && mapping.transform) {
      value = applyTransforms(value, mapping.transform);
    }
    if (value !== null && value !== undefined && value !== '') {
      if (mapping.target === 'skuQuantity') {
        (record as Record<string, unknown>)[mapping.target] = parseFloat(value) || 0;
      } else {
        (record as Record<string, unknown>)[mapping.target] = value;
      }
    }
  }

  return record as WaybillRecord;
}

function resolveSource(
  row: ExtractedRow,
  source: FieldSource,
  footerData: Record<string, string>
): string | null {
  switch (source.type) {
    case 'column':
      return row[`col_${source.index}`] ?? null;
    case 'columnName':
      return row[`name_${source.name}`] ?? null;
    case 'fixed':
      return source.value;
    case 'footer':
      return Object.values(footerData)[source.fieldIndex] ?? null;
    case 'cardHeader':
      // 查找card_开头的字段
      const cardKeys = Object.keys(row).filter((k) => k.startsWith('card_'));
      return cardKeys[source.fieldIndex] ? row[cardKeys[source.fieldIndex]] : null;
    case 'regex': {
      const text = Object.values(row).join(' ');
      const match = text.match(new RegExp(source.pattern));
      return match?.[source.group] ?? null;
    }
    case 'concat':
      return source.sources
        .map((s) => resolveSource(row, s, footerData))
        .filter(Boolean)
        .join(source.separator ?? ' ');
  }
}

function applyTransforms(value: string, transforms: TransformStep[]): string {
  let result = value;
  for (const t of transforms) {
    switch (t.type) {
      case 'trim': result = result.trim(); break;
      case 'toNumber': result = String(parseFloat(result) || 0); break;
      case 'replace': result = result.replace(new RegExp(t.pattern, 'g'), t.replacement); break;
      case 'split': result = result.split(t.separator)[t.index] ?? result; break;
      case 'prefix': result = t.value + result; break;
      case 'suffix': result = result + t.value; break;
      case 'regex': {
        const m = result.match(new RegExp(t.pattern));
        result = m?.[t.group] ?? result;
        break;
      }
    }
  }
  return result;
}

// ===== 后处理 =====
function applyPostprocess(records: WaybillRecord[], steps: PostprocessStep[]): WaybillRecord[] {
  let result = records;
  for (const step of steps) {
    switch (step.type) {
      case 'dedup': {
        const seen = new Set<string>();
        result = result.filter((r) => {
          const key = String(r[step.by as keyof WaybillRecord] ?? '');
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        break;
      }
      case 'filterEmpty':
        result = result.filter((r) =>
          step.requiredFields.every((f) => {
            const val = r[f as keyof WaybillRecord];
            return val !== undefined && val !== null && val !== '';
          })
        );
        break;
      case 'mergeRows':
        // 简单实现：按groupBy合并mergeField
        break;
    }
  }
  return result;
}
