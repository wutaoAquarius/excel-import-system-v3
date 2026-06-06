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
  TextExtraction,
  CardSplitStep,
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

    // cardSplit 多卡片拆分
    const cardSplitStep = rule.preprocessing.find(
      (s): s is CardSplitStep => s.type === 'cardSplit'
    );
    if (cardSplitStep && rule.dataExtraction.mode === 'card') {
      // 按 __boundary__ 标记将 rows 拆分为多个子数组
      const cards: (string | null)[][][] = [];
      let current: (string | null)[][] = [];
      for (const row of rows) {
        if (row[0] === '__boundary__') {
          if (current.length > 0) cards.push(current);
          current = [];
        } else {
          current.push(row);
        }
      }
      if (current.length > 0) cards.push(current);

      for (const cardRows of cards) {
        const extracted = extractCard(cardRows, rule.dataExtraction);
        const records = extracted.map((row) =>
          mapFields(row, rule.fieldMapping, footerData)
        );
        allRecords.push(...records);
      }
      continue;
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
  const rows: (string | null)[][] = lines.map((line) => {
    // 按2个以上空白或制表符拆分，检测表格列结构
    const cells = line.split(/\t|\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
    return cells.length > 1 ? cells : [line];
  });

  let processedRows = [...rows];
  let footerData: Record<string, string> = {};

  for (const step of rule.preprocessing) {
    const result = applyPreprocess(processedRows, step);
    processedRows = result.rows;
    if (result.footerData) {
      footerData = { ...footerData, ...result.footerData };
    }
  }

  // PDF 多单拆分：有 cardSplit 时按 __boundary__ 标记分段处理
  const cardSplitStep = rule.preprocessing.find(
    (s): s is CardSplitStep => s.type === 'cardSplit'
  );
  if (cardSplitStep) {
    const segments: (string | null)[][][] = [];
    let current: (string | null)[][] = [];
    for (const row of processedRows) {
      if (row[0] === '__boundary__') {
        if (current.length > 0) segments.push(current);
        current = [];
      } else {
        current.push(row);
      }
    }
    if (current.length > 0) segments.push(current);

    const allRecords: WaybillRecord[] = [];
    for (const segRows of segments) {
      const extracted = extractData(segRows, rule.dataExtraction);
      const records = extracted.map((row) =>
        mapFields(row, rule.fieldMapping, footerData)
      );
      allRecords.push(...records);
    }
    return applyPostprocess(allRecords, rule.postprocessing);
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
      // 搜索范围扩大：从 startRow-2 开始搜索，确保 label 在边界附近也能被找到
      const searchStart = Math.max(0, startRow - 2);
      for (const field of step.fields) {
        if (field.row === 'auto') {
          for (let r = searchStart; r < rows.length; r++) {
            if (field.label && field.labelCol !== undefined) {
              const labelCell = rows[r]?.[field.labelCol]?.trim() || '';
              if (labelCell.includes(field.label)) {
                const value = rows[r]?.[field.col];
                if (value) footerData[field.target] = value.trim();
                break;
              }
            } else {
              const value = rows[r]?.[field.col];
              if (value && value.trim()) {
                footerData[field.target] = value.trim();
                break;
              }
            }
          }
        } else {
          const row = field.row;
          if (row < rows.length) {
            const value = rows[row]?.[field.col];
            if (value) footerData[field.target] = value.trim();
          }
        }
      }
      // 移除footer行
      return { rows: rows.slice(0, startRow), footerData };
    }

    case 'cardSplit': {
      // 在每行第一列打上 __boundary__ 标记，供 executeExcelRule/executePdfRule 使用
      const marked = rows.map((row) => {
        const cell = row[0] ?? '';
        let isBoundary = false;
        if (step.matchMode === 'startsWith') {
          isBoundary = cell.startsWith(step.boundary);
        } else if (step.matchMode === 'contains') {
          isBoundary = cell.includes(step.boundary);
        } else if (step.matchMode === 'regex') {
          isBoundary = new RegExp(step.boundary).test(cell);
        }
        if (isBoundary) {
          return ['__boundary__', ...row.slice(1)];
        }
        return row;
      });
      return { rows: marked };
    }

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
    case 'text': return extractText(rows, config);
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
  // 过滤掉非门店的汇总/余量列
  const skipPatterns = ['结余', '合计', '库存', '余量'];
  const result: ExtractedRow[] = [];

  for (let i = config.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;

    for (let p = 0; p < pivotHeaders.length; p++) {
      const headerVal = pivotHeaders[p]?.trim();
      // 跳过空列头或非门店汇总列
      if (!headerVal || skipPatterns.some((pat) => headerVal.includes(pat))) continue;

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
      // 兼容columnName source类型
      record[`name_pivot_header`] = pivotHeaders[p] ?? null;
      record[`name_pivot_value`] = value;
      result.push(record);
    }
  }
  return result;
}

function extractGrouped(rows: (string | null)[][], config: GroupedExtraction): ExtractedRow[] {
  const headers = rows[config.headerRow]?.map((h) => h?.trim() || '') || [];

  // 第一遍：按 groupByCol 分组，空值行继承上一行 groupKey
  type GroupEntry = { key: string; rowIndices: number[] };
  const groups: GroupEntry[] = [];
  const groupIndexMap = new Map<string, number>();
  let lastKey = '';

  for (let i = config.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;
    const cellVal = row[config.groupByCol]?.trim() || '';
    const key = cellVal || lastKey;
    if (!key) continue;
    if (cellVal) lastKey = cellVal;

    if (!groupIndexMap.has(key)) {
      groupIndexMap.set(key, groups.length);
      groups.push({ key, rowIndices: [] });
    }
    groups[groupIndexMap.get(key)!].rowIndices.push(i);
  }

  // 第二遍：组内提取，sharedFields 取组内第一行，广播到所有行
  const result: ExtractedRow[] = [];

  for (const group of groups) {
    // 收集组内所有行的基础字段
    const groupRows: ExtractedRow[] = group.rowIndices.map((i) => {
      const row = rows[i];
      const record: ExtractedRow = {};
      headers.forEach((h, idx) => {
        record[`col_${idx}`] = row[idx] ?? null;
        if (h) record[`name_${h}`] = row[idx] ?? null;
      });
      return record;
    });

    // 从第一行解析 sharedFields（用 mapFields 替代逻辑，直接读取源列）
    const sharedValues: ExtractedRow = {};
    for (const mapping of config.sharedFields) {
      const firstRow = groupRows[0];
      if (!firstRow) continue;
      const src = mapping.source;
      let val: string | null = null;
      if (src.type === 'column') {
        val = firstRow[`col_${src.index}`] ?? null;
      } else if (src.type === 'columnName') {
        val = firstRow[`name_${src.name}`] ?? null;
      } else if (src.type === 'fixed') {
        val = src.value;
      }
      if (val !== null) {
        sharedValues[`shared_${mapping.target}`] = val;
      }
    }

    // 将 sharedValues 广播到组内所有行
    for (const record of groupRows) {
      for (const [k, v] of Object.entries(sharedValues)) {
        record[k] = v;
      }
      result.push(record);
    }
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

function extractText(rows: (string | null)[][], config: TextExtraction): ExtractedRow[] {
  // 将 rows 转为文本行数组
  const lines = rows.map((row) => row[0] ?? '');
  const fullText = lines.join('\n');

  const result: ExtractedRow[] = [];

  if (config.separator) {
    // 有分隔符：按 separator 拆分记录块，每块一条记录
    const blocks = fullText.split(config.separator).map((b) => b.trim()).filter((b) => b.length > 0);
    for (const block of blocks) {
      const record: ExtractedRow = {};
      const blockLines = block.split('\n');
      for (const lp of config.linePatterns) {
        const re = new RegExp(lp.pattern);
        for (const line of blockLines) {
          const match = line.match(re);
          if (match) {
            for (const cap of lp.captures) {
              const val = match[cap.group] ?? null;
              if (val !== null) record[`name_${cap.target}`] = val.trim();
            }
            break;
          }
        }
      }
      if (Object.keys(record).length > 0) result.push(record);
    }
  } else {
    // 无分隔符：逐行匹配，每行独立生成记录
    for (const line of lines) {
      if (!line.trim()) continue;
      const record: ExtractedRow = {};
      for (const lp of config.linePatterns) {
        const re = new RegExp(lp.pattern);
        const match = line.match(re);
        if (match) {
          for (const cap of lp.captures) {
            const val = match[cap.group] ?? null;
            if (val !== null) record[`name_${cap.target}`] = val.trim();
          }
        }
      }
      if (Object.keys(record).length > 0) result.push(record);
    }
  }
  return result;
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
