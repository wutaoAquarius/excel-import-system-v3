/**
 * 端到端集成测试脚本
 * 覆盖：文件上传 → 规则选择 → 解析执行 → 结果校验 → 订单提交 全流程
 *
 * 运行方式：
 *   npx vitest run src/test/e2e-integration.test.ts
 *   本地开发: BASE_URL=http://localhost:3000 npx vitest run src/test/e2e-integration.test.ts
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// E2E测试需要较长超时（网络请求）
const TEST_TIMEOUT = 30000;
const BASE_URL = (process.env.BASE_URL && process.env.BASE_URL.startsWith('http'))
  ? process.env.BASE_URL
  : 'http://localhost:3000';
const DEMOS_DIR = fs.existsSync(path.resolve(__dirname, '../../docs/demos'))
  ? path.resolve(__dirname, '../../docs/demos')
  : path.resolve(__dirname, '../../../docs/demos');
const EXPECTED_DIR = path.join(DEMOS_DIR, 'expected-results');

// ===== 工具函数 =====

async function uploadFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer]);
  const formData = new FormData();
  const fileName = path.basename(filePath);
  formData.append('file', blob, fileName);

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  return { status: res.status, data: await res.json() };
}

async function parseWithRule(rawData: unknown, ruleConfig: unknown) {
  const res = await fetch(`${BASE_URL}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawData, ruleConfig }),
  });
  return { status: res.status, data: await res.json() };
}

async function getRules() {
  const res = await fetch(`${BASE_URL}/api/rules`);
  return (await res.json()).data as Array<{
    id: string;
    name: string;
    config: unknown;
  }>;
}

async function submitOrders(records: unknown[], fileName = 'test-upload.xlsx') {
  const res = await fetch(`${BASE_URL}/api/orders/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, fileName }),
  });
  return { status: res.status, data: await res.json() };
}

async function getOrders(page = 1, pageSize = 50) {
  const res = await fetch(
    `${BASE_URL}/api/orders?page=${page}&pageSize=${pageSize}`
  );
  return { status: res.status, data: await res.json() };
}

function loadExpected(fileName: string) {
  const fp = path.join(EXPECTED_DIR, fileName);
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

/**
 * 对比解析结果与预期结果
 * 只校验预期中明确指定的字段
 */
function assertRecordsMatch(
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[],
  options: { exactCount?: boolean; partialMatch?: boolean } = {}
) {
  if (options.exactCount) {
    expect(actual.length).toBe(expected.length);
  } else {
    expect(actual.length).toBeGreaterThanOrEqual(expected.length);
  }

  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    // 在 actual 中按 skuCode + storeName 查找匹配记录
    const match = actual.find(
      (a) =>
        a.skuCode === exp.skuCode &&
        (exp.storeName ? a.storeName === exp.storeName : true) &&
        (exp.skuQuantity ? Number(a.skuQuantity) === Number(exp.skuQuantity) : true)
    );
    if (!options.partialMatch) {
      expect(match, `未找到预期记录 #${i}: ${JSON.stringify(exp)}`).toBeDefined();
    }
    if (match) {
      for (const [key, val] of Object.entries(exp)) {
        if (key === 'skuQuantity') {
          expect(Number(match[key])).toBe(Number(val));
        } else {
          expect(match[key], `字段 ${key} 不匹配: ${match[key]} !== ${val}`).toBe(val);
        }
      }
    }
  }
}

// ===== 测试套件 =====

describe('E2E 集成测试 - 全流程', { timeout: TEST_TIMEOUT }, () => {
  let rules: Array<{ id: string; name: string; config: unknown }> = [];

  beforeAll(async () => {
    // 确保 seed 数据存在
    const existingRules = await getRules();
    if (existingRules.length === 0) {
      await fetch(`${BASE_URL}/api/seed`, { method: 'POST' });
    }
    rules = await getRules();
    expect(rules.length).toBeGreaterThanOrEqual(9);
  }, 30000);

  // ===== 1. API 基础可用性 =====
  describe('1. API 基础可用性', () => {
    it('GET /api/rules 返回 200', async () => {
      const res = await fetch(`${BASE_URL}/api/rules`);
      expect(res.status).toBe(200);
    });

    it('GET /api/orders 返回 200', async () => {
      const res = await fetch(`${BASE_URL}/api/orders`);
      expect(res.status).toBe(200);
    });

    it('POST /api/upload 无文件返回 400', async () => {
      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        body: new FormData(),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/upload 不支持格式返回 400', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');
      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('不支持的文件格式');
    });

    it('POST /api/orders/submit 空记录返回 400', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [] }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ===== 2. 规则 CRUD =====
  describe('2. 规则 CRUD', () => {
    let testRuleId: string;

    it('POST /api/rules 创建规则', async () => {
      const res = await fetch(`${BASE_URL}/api/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E测试规则',
          fileType: 'excel',
          config: {
            fileType: 'excel',
            preprocessing: [],
            dataExtraction: { mode: 'table', headerRow: 0, dataStartRow: 1 },
            fieldMapping: [],
            postprocessing: [],
          },
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      testRuleId = data.data.id;
      expect(testRuleId).toBeDefined();
    });

    it('GET /api/rules/:id 获取单条', async () => {
      const res = await fetch(`${BASE_URL}/api/rules/${testRuleId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe('E2E测试规则');
    });

    it('PUT /api/rules/:id 更新规则', async () => {
      const res = await fetch(`${BASE_URL}/api/rules/${testRuleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E测试规则-已修改' }),
      });
      expect(res.status).toBe(200);
    });

    it('DELETE /api/rules/:id 删除规则', async () => {
      const res = await fetch(`${BASE_URL}/api/rules/${testRuleId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
    });
  });

  // ===== 3. 文件上传 =====
  describe('3. 文件上传', () => {
    it('上传 Excel 文件成功', async () => {
      const filePath = path.join(DEMOS_DIR, '12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');
      const { status, data } = await uploadFile(filePath);
      expect(status).toBe(200);
      expect(data.data.summary.sheetsCount).toBe(1);
      expect(data.data.summary.rowsCount).toBe(10);
      expect(data.data.rawData.type).toBe('excel');
    });

    it('上传 PDF 文件成功', async () => {
      const filePath = path.join(DEMOS_DIR, '黔寨寨贵州烙锅（鞍山店）常温.pdf');
      const { status, data } = await uploadFile(filePath);
      expect(status).toBe(200);
      expect(data.data.rawData.type).toBe('pdf');
      expect(data.data.rawData.pages.length).toBeGreaterThan(0);
    });

    it('上传多Sheet Excel文件', async () => {
      const filePath = path.join(DEMOS_DIR, '多门店分Sheet出库单.xlsx');
      const { status, data } = await uploadFile(filePath);
      expect(status).toBe(200);
      expect(data.data.summary.sheetsCount).toBe(3);
    });
  });

  // ===== 4. 解析引擎 - 黎明屯配送发货单 (尾部提取) =====
  describe('4. 黎明屯配送发货单 - 尾部提取', () => {
    it('应正确解析SKU并提取底部收货人信息', async () => {
      const filePath = path.join(DEMOS_DIR, '12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '黎明屯配送发货单');
      expect(rule).toBeDefined();

      const { status, data } = await parseWithRule(uploadData.data.rawData, rule!.config);
      expect(status).toBe(200);
      expect(data.data.totalCount).toBe(2);

      const records = data.data.records;
      // 验证SKU数据
      expect(records[0].skuCode).toBe('LMTZ0160009');
      expect(records[0].skuName).toBe('成品锅包肉(含汁)');
      expect(records[0].skuQuantity).toBe(20);
      expect(records[0].skuSpec).toBe('1kg*10袋*箱');
      // 验证尾部提取
      expect(records[0].receiverName).toBe('张锦峰');
      expect(records[0].receiverPhone).toBe('18533660999');
      expect(records[0].receiverAddress).toContain('龙湖海口天街');
      expect(records[0].externalCode).toBe('PS2512220005001');
    });
  });

  // ===== 5. 解析引擎 - 欢乐牧场 (矩阵转置) =====
  describe('5. 欢乐牧场模板 - 矩阵转置', () => {
    it('应正确转置门店列并过滤下单后结余', async () => {
      const filePath = path.join(DEMOS_DIR, '欢乐牧场模板0430.xlsx');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '欢乐牧场模板');
      expect(rule).toBeDefined();

      const { status, data } = await parseWithRule(uploadData.data.rawData, rule!.config);
      expect(status).toBe(200);

      const records = data.data.records;
      const expected = loadExpected('欢乐牧场模板0430.json');
      expect(records.length).toBe(expected.length);
      assertRecordsMatch(records, expected, { exactCount: true });
    });
  });

  // ===== 6. 解析引擎 - 门店调拨单 (卡片模式) =====
  describe('6. 门店调拨单-卡片式', () => {
    it('应正确识别卡片边界并提取头部字段', async () => {
      const filePath = path.join(DEMOS_DIR, '门店调拨单-卡片式.xlsx');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '门店调拨单-卡片式');
      expect(rule).toBeDefined();

      const { status, data } = await parseWithRule(uploadData.data.rawData, rule!.config);
      expect(status).toBe(200);

      const records = data.data.records;
      // 卡片模式：预期9条记录（3卡片 × 3行）
      expect(records.length).toBe(9);
      // 验证核心SKU字段（externalCode暂未在规则中映射）
      expect(records[0].skuCode).toBe('ZBWP0001');
      expect(records[0].skuName).toBe('茶语柠听紫苏风味糖浆');
      expect(records[0].skuQuantity).toBe(3);
      // 验证卡片头部字段提取
      expect(records[0].storeName).toBeDefined();
      expect(records[0].receiverName).toBeDefined();
      expect(records[0].receiverPhone).toBeDefined();
    });
  });

  // ===== 7. 解析引擎 - 多门店分Sheet =====
  describe('7. 多门店分Sheet出库单', () => {
    it('应正确合并多Sheet并提取SKU数据', async () => {
      const filePath = path.join(DEMOS_DIR, '多门店分Sheet出库单.xlsx');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '多门店分Sheet出库单');
      expect(rule).toBeDefined();

      const { status, data } = await parseWithRule(uploadData.data.rawData, rule!.config);
      expect(status).toBe(200);

      const records = data.data.records;
      // 3个Sheet × 7个SKU = 21条
      expect(records.length).toBe(21);
      // 验证SKU核心字段
      expect(records[0].skuCode).toBe('ZBWP0001');
      expect(records[0].skuName).toBe('茶语柠听紫苏风味糖浆');
      expect(records[0].skuQuantity).toBe(3);
    });
  });

  // ===== 8. 解析引擎 - 湖南仓 (跨行聚合) =====
  describe('8. 湖南仓发货明细', () => {
    it('应正确按列索引提取多列数据', async () => {
      const filePath = path.join(DEMOS_DIR, '湖南仓.xlsx');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '湖南仓发货明细');
      expect(rule).toBeDefined();

      const { status, data } = await parseWithRule(uploadData.data.rawData, rule!.config);
      expect(status).toBe(200);

      const records = data.data.records;
      expect(records.length).toBeGreaterThan(80);
      // 验证第一条有效数据(跳过标题行后)
      const firstValid = records.find(
        (r: Record<string, unknown>) => r.skuCode && String(r.skuCode).startsWith('ZBWP')
      );
      expect(firstValid).toBeDefined();
      expect(firstValid.receiverName).toBeDefined();
      expect(firstValid.receiverPhone).toBeDefined();
      expect(firstValid.receiverAddress).toBeDefined();
      expect(firstValid.externalCode).toBeDefined();
    });
  });

  // ===== 9. 解析引擎 - PDF 文本解析 =====
  describe('9. 黔寨寨PDF配送单', () => {
    it('应从PDF文本中正则提取SKU和收货人', async () => {
      const filePath = path.join(DEMOS_DIR, '黔寨寨贵州烙锅（鞍山店）常温.pdf');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '黔寨寨配送单(PDF)');
      expect(rule).toBeDefined();

      const { status, data } = await parseWithRule(uploadData.data.rawData, rule!.config);
      expect(status).toBe(200);

      const records = data.data.records;
      expect(records.length).toBeGreaterThanOrEqual(30);
      // 验证首条数据
      const first = records[0];
      expect(first.skuCode).toBe('ZBWP0001');
      expect(first.skuName).toContain('茶语柠听紫苏风味糖浆');
      expect(first.skuQuantity).toBe(2);
      expect(first.externalCode).toBe('PS2604210007');
      // 验证收货人全局字段
      expect(first.receiverName).toBe('荣丽');
      expect(first.receiverAddress).toContain('鞍山');
    });
  });

  // ===== 10. 订单提交与查询 =====
  describe('10. 订单提交与查询', () => {
    it('提交解析结果后可查询到订单', async () => {
      // 用黎明屯数据提交
      const filePath = path.join(DEMOS_DIR, '12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');
      const { data: uploadData } = await uploadFile(filePath);
      const rule = rules.find((r) => r.name === '黎明屯配送发货单');
      const { data: parseData } = await parseWithRule(uploadData.data.rawData, rule!.config);

      const records = parseData.data.records;
      const { status } = await submitOrders(records);
      expect(status).toBe(200);

      // 查询订单列表
      const { status: listStatus, data: listData } = await getOrders();
      expect(listStatus).toBe(200);
      expect(listData.data.total).toBeGreaterThan(0);
      expect(listData.data.records.length).toBeGreaterThan(0);
    });
  });

  // ===== 11. Seed 接口 =====
  describe('11. Seed 接口', () => {
    it('POST /api/seed 可重复调用', async () => {
      const res = await fetch(`${BASE_URL}/api/seed`, { method: 'POST' });
      // 可能成功也可能因为唯一约束失败，都不应 500
      expect(res.status).not.toBe(500);
    });
  });
});
