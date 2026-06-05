'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Input, DatePicker, Space, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface OrderItem { id: string; externalCode: string; storeName: string; receiverName: string; receiverPhone: string; skuCode: string; skuName: string; skuQuantity: number; skuSpec: string; createdAt: string; }

export default function OrdersPage() {
  const [data, setData] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20', keyword });
      if (dateRange) {
        params.set('startDate', dateRange[0]);
        params.set('endDate', dateRange[1]);
      }
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      if (json.data) { setData(json.data.records); setTotal(json.data.total); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, keyword, dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = [
    { title: '外部编码', dataIndex: 'externalCode', key: 'externalCode', width: 140 },
    { title: '收货门店', dataIndex: 'storeName', key: 'storeName', width: 160 },
    { title: '收件人', dataIndex: 'receiverName', key: 'receiverName', width: 100 },
    { title: '电话', dataIndex: 'receiverPhone', key: 'receiverPhone', width: 130 },
    { title: 'SKU编码', dataIndex: 'skuCode', key: 'skuCode', width: 130 },
    { title: 'SKU名称', dataIndex: 'skuName', key: 'skuName', width: 180 },
    { title: '数量', dataIndex: 'skuQuantity', key: 'skuQuantity', width: 70 },
    { title: '规格', dataIndex: 'skuSpec', key: 'skuSpec', width: 140 },
    { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
  ];

  return (
    <Card title="已导入运单" className="shadow-sm" extra={
      <Space>
        <Input placeholder="搜索外部编码/收件人" prefix={<SearchOutlined />} allowClear value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} style={{ width: 250 }} />
        <DatePicker.RangePicker
          onChange={(_, dateStrings) => {
            const [start, end] = dateStrings;
            setDateRange(start && end ? [start, end] : null);
            setPage(1);
          }}
        />
      </Space>
    }>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} scroll={{ x: 1200 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }} />
    </Card>
  );
}
