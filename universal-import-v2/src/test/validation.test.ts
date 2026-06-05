/**
 * 数据校验测试
 * 覆盖：运单字段必填规则、A组/B组二选一、电话格式、数量正数
 */
import { describe, it, expect } from 'vitest';
import type { WaybillRecord } from '@/lib/rules/types';

// 校验函数 - 根据需求文档实现
interface ValidationError {
  row: number;
  field: string;
  message: string;
}

function validateWaybillRecords(records: WaybillRecord[]): ValidationError[] {
  const errors: ValidationError[] = [];

  records.forEach((record, index) => {
    const rowNum = index + 1;

    // 必填字段检查
    if (!record.skuCode || record.skuCode.trim() === '') {
      errors.push({ row: rowNum, field: 'skuCode', message: 'SKU物品编码为必填' });
    }
    if (!record.skuName || record.skuName.trim() === '') {
      errors.push({ row: rowNum, field: 'skuName', message: 'SKU物品名称为必填' });
    }
    if (!record.skuQuantity || record.skuQuantity <= 0) {
      errors.push({ row: rowNum, field: 'skuQuantity', message: 'SKU发货数量必须为正数' });
    }

    // A组/B组二选一
    const hasStore = record.storeName && record.storeName.trim() !== '';
    const hasReceiver = record.receiverName && record.receiverName.trim() !== ''
      && record.receiverPhone && record.receiverPhone.trim() !== ''
      && record.receiverAddress && record.receiverAddress.trim() !== '';

    if (!hasStore && !hasReceiver) {
      errors.push({ row: rowNum, field: 'receiver', message: '收货门店(A组)或收件人信息(B组)至少填一组' });
    }

    // 电话格式检查（如果填了）
    if (record.receiverPhone && record.receiverPhone.trim() !== '') {
      const phone = record.receiverPhone.trim();
      if (!/^1[3-9]\d{9}$/.test(phone) && !/^\d{3,4}-?\d{7,8}$/.test(phone)) {
        errors.push({ row: rowNum, field: 'receiverPhone', message: '电话格式不正确' });
      }
    }
  });

  return errors;
}

describe('运单数据校验', () => {
  describe('必填字段检查', () => {
    it('缺少skuCode应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: '', skuName: '苹果', skuQuantity: 10, storeName: '门店A' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.some(e => e.field === 'skuCode')).toBe(true);
    });

    it('缺少skuName应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '', skuQuantity: 10, storeName: '门店A' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.some(e => e.field === 'skuName')).toBe(true);
    });

    it('数量为0或负数应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 0, storeName: '门店A' },
        { skuCode: 'SKU002', skuName: '香蕉', skuQuantity: -5, storeName: '门店B' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.filter(e => e.field === 'skuQuantity')).toHaveLength(2);
    });

    it('正常数据不应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, storeName: '门店A' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors).toHaveLength(0);
    });
  });

  describe('A组/B组二选一', () => {
    it('只填门店(A组)应通过', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, storeName: '门店A' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.filter(e => e.field === 'receiver')).toHaveLength(0);
    });

    it('填收件人三要素(B组)应通过', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, receiverName: '张三', receiverPhone: '13800138000', receiverAddress: '北京市朝阳区' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.filter(e => e.field === 'receiver')).toHaveLength(0);
    });

    it('B组缺少地址应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, receiverName: '张三', receiverPhone: '13800138000' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.some(e => e.field === 'receiver')).toBe(true);
    });

    it('两组都没填应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10 },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.some(e => e.field === 'receiver')).toBe(true);
    });
  });

  describe('电话格式校验', () => {
    it('正确手机号应通过', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, receiverName: '张三', receiverPhone: '13800138000', receiverAddress: '北京' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.filter(e => e.field === 'receiverPhone')).toHaveLength(0);
    });

    it('错误手机号应报错', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, receiverName: '张三', receiverPhone: '1234', receiverAddress: '北京' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.some(e => e.field === 'receiverPhone')).toBe(true);
    });

    it('固话格式应通过', () => {
      const records: WaybillRecord[] = [
        { skuCode: 'SKU001', skuName: '苹果', skuQuantity: 10, receiverName: '张三', receiverPhone: '010-12345678', receiverAddress: '北京' },
      ];
      const errors = validateWaybillRecords(records);
      expect(errors.filter(e => e.field === 'receiverPhone')).toHaveLength(0);
    });
  });
});
