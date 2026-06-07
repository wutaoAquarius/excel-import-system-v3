'use client';

import React from 'react';
import { Table, Select, Input, InputNumber, Switch, Button, Space, Card, Divider, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { RuleConfig, HeaderField, DetailColumn, TargetField } from '@/lib/rules/config';
import { FIELD_LABELS, TARGET_FIELDS } from '@/lib/rules/config';

interface RuleConfigEditorProps {
  config: RuleConfig;
  onChange: (config: RuleConfig) => void;
  preview?: unknown[][];
}

const METHOD_LABELS = { keyword: '关键词搜索', cell: '固定坐标', sheet_name: 'Sheet名称' };
const POST_PROCESS_OPTIONS = [
  { value: 'keep', label: '保持原样' },
  { value: 'trim', label: '去空格' },
  { value: 'convert_to_number', label: '转为数字' },
];

export default function RuleConfigEditor({ config, onChange }: RuleConfigEditorProps) {
  // === Header 操作 ===
  const updateHeader = (index: number, updates: Partial<HeaderField>) => {
    const newHeaders = [...config.header];
    newHeaders[index] = { ...newHeaders[index], ...updates };
    onChange({ ...config, header: newHeaders });
  };
  const removeHeader = (index: number) => {
    onChange({ ...config, header: config.header.filter((_, i) => i !== index) });
  };
  const addHeader = () => {
    const newField: HeaderField = { field: 'storeName', method: 'cell', row: 0, col: 0, post_process: 'keep' };
    onChange({ ...config, header: [...config.header, newField] });
  };

  // === Detail Column 操作 ===
  const updateColumn = (index: number, updates: Partial<DetailColumn>) => {
    const newCols = [...config.detail.columns];
    newCols[index] = { ...newCols[index], ...updates };
    onChange({ ...config, detail: { ...config.detail, columns: newCols } });
  };
  const removeColumn = (index: number) => {
    const newCols = config.detail.columns.filter((_, i) => i !== index);
    onChange({ ...config, detail: { ...config.detail, columns: newCols } });
  };
  const addColumn = () => {
    const newCol: DetailColumn = { field: 'skuCode', col: 0, post_process: 'keep' };
    onChange({ ...config, detail: { ...config.detail, columns: [...config.detail.columns, newCol] } });
  };

  // === Header 表格列定义 ===
  const headerColumns = [
    {
      title: '目标字段', dataIndex: 'field', width: 120,
      render: (val: string, _: HeaderField, idx: number) => (
        <Select size="small" className="w-full" value={val}
          onChange={(v) => updateHeader(idx, { field: v as TargetField })}
          options={TARGET_FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }))} />
      ),
    },
    {
      title: '提取方式', dataIndex: 'method', width: 110,
      render: (val: string, _: HeaderField, idx: number) => (
        <Select size="small" className="w-full" value={val}
          onChange={(v) => updateHeader(idx, { method: v as HeaderField['method'] })}
          options={Object.entries(METHOD_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
      ),
    },
    {
      title: '参数', key: 'params', width: 240,
      render: (_: unknown, record: HeaderField, idx: number) => {
        if (record.method === 'keyword') {
          return (
            <Space size={4} wrap>
              <Input size="small" style={{ width: 100 }} placeholder="关键词" value={record.keyword}
                onChange={(e) => updateHeader(idx, { keyword: e.target.value })} />
              <Select size="small" style={{ width: 70 }} value={record.direction ?? 'right'}
                onChange={(v) => updateHeader(idx, { direction: v })}
                options={[{ value: 'right', label: '右侧' }, { value: 'below', label: '下方' }]} />
              <Input size="small" style={{ width: 60 }} placeholder="分隔符" value={record.separator}
                onChange={(e) => updateHeader(idx, { separator: e.target.value })} />
            </Space>
          );
        }
        if (record.method === 'cell') {
          return (
            <Space size={4}>
              <InputNumber size="small" style={{ width: 70 }} min={0} addonBefore="行" value={record.row}
                onChange={(v) => updateHeader(idx, { row: v ?? 0 })} />
              <InputNumber size="small" style={{ width: 70 }} min={0} addonBefore="列" value={record.col}
                onChange={(v) => updateHeader(idx, { col: v ?? 0 })} />
            </Space>
          );
        }
        return <span className="text-gray-400 text-xs">无需参数</span>;
      },
    },
    {
      title: '后处理', dataIndex: 'post_process', width: 130,
      render: (val: string, _: HeaderField, idx: number) => (
        <Input size="small" value={val} onChange={(e) => updateHeader(idx, { post_process: e.target.value })}
          placeholder="keep" />
      ),
    },
    {
      title: '', key: 'action', width: 40,
      render: (_: unknown, __: HeaderField, idx: number) => (
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeHeader(idx)} />
      ),
    },
  ];

  // === Detail 表格列定义 ===
  const detailColumns = [
    {
      title: '目标字段', dataIndex: 'field', width: 120,
      render: (val: string, _: DetailColumn, idx: number) => (
        <Select size="small" className="w-full" value={val} showSearch
          onChange={(v) => updateColumn(idx, { field: v })}
          options={[
            ...TARGET_FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] })),
            { value: '_custom', label: '自定义...' },
          ]} />
      ),
    },
    {
      title: '列号', dataIndex: 'col', width: 80,
      render: (val: number, _: DetailColumn, idx: number) => (
        <InputNumber size="small" min={0} value={val} className="w-full"
          onChange={(v) => updateColumn(idx, { col: v ?? 0 })} />
      ),
    },
    {
      title: '后处理', dataIndex: 'post_process', width: 130,
      render: (val: string, _: DetailColumn, idx: number) => (
        <Input size="small" value={val} onChange={(e) => updateColumn(idx, { post_process: e.target.value })}
          placeholder="keep" />
      ),
    },
    {
      title: '', key: 'action', width: 40,
      render: (_: unknown, __: DetailColumn, idx: number) => (
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeColumn(idx)} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 头部字段区 */}
      <Card size="small" title="📋 头部字段 (header)" extra={
        <Button size="small" icon={<PlusOutlined />} onClick={addHeader}>添加字段</Button>
      }>
        <Table dataSource={config.header.map((h, i) => ({ ...h, _key: i }))} columns={headerColumns}
          rowKey="_key" size="small" pagination={false}
          expandable={{
            expandedRowRender: (record, idx) => (
              <Input.TextArea size="small" autoSize={{ minRows: 1, maxRows: 3 }}
                placeholder="字段提取说明（如何从文件中找到这个数据）"
                value={record.description} onChange={(e) => updateHeader(idx, { description: e.target.value })} />
            ),
            rowExpandable: () => true,
            defaultExpandAllRows: true,
          }} />
      </Card>

      <Divider className="my-2" />

      {/* 明细表格区 */}
      <Card size="small" title="📊 明细表格 (detail)" extra={
        <Button size="small" icon={<PlusOutlined />} onClick={addColumn}>添加列</Button>
      }>
        {/* 控制行 */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-500">起始行</label>
            <InputNumber size="small" className="w-full" min={0} value={config.detail.start_row}
              onChange={(v) => onChange({ ...config, detail: { ...config.detail, start_row: v ?? 0 } })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">结束条件</label>
            <Input size="small" value={config.detail.end_condition} placeholder="blank_row"
              onChange={(e) => onChange({ ...config, detail: { ...config.detail, end_condition: e.target.value } })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">分组字段</label>
            <Input size="small" value={config.detail.group_by} placeholder="无"
              onChange={(e) => onChange({ ...config, detail: { ...config.detail, group_by: e.target.value || undefined } })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">卡片分隔</label>
            <Input size="small" value={config.detail.block_separator} placeholder="无"
              onChange={(e) => onChange({ ...config, detail: { ...config.detail, block_separator: e.target.value || undefined } })} />
          </div>
        </div>

        <Table dataSource={config.detail.columns.map((c, i) => ({ ...c, _key: i }))} columns={detailColumns}
          rowKey="_key" size="small" pagination={false}
          expandable={{
            expandedRowRender: (record, idx) => (
              <Input.TextArea size="small" autoSize={{ minRows: 1, maxRows: 3 }}
                placeholder="字段提取说明"
                value={record.description} onChange={(e) => updateColumn(idx, { description: e.target.value })} />
            ),
            rowExpandable: () => true,
            defaultExpandAllRows: true,
          }} />
      </Card>

      <Divider className="my-2" />

      {/* 矩阵转置区（可选） */}
      <Card size="small" title={
        <Space>
          <span>🔄 矩阵转置 (pivot)</span>
          <Tooltip title="启用后，指定列范围内的每个非空格子会转为独立记录">
            <InfoCircleOutlined className="text-gray-400" />
          </Tooltip>
        </Space>
      } extra={
        <Switch size="small" checked={!!config.detail.pivot}
          onChange={(checked) => {
            if (checked) {
              onChange({ ...config, detail: { ...config.detail, pivot: {
                pivot_start_col: 0, skip_zero_values: true, pivot_target_field: 'storeName', value_field: 'skuQuantity'
              }}});
            } else {
              const { pivot: _, ...rest } = config.detail;
              onChange({ ...config, detail: rest as typeof config.detail });
            }
          }} />
      }>
        {config.detail.pivot && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">起始列</label>
              <InputNumber size="small" className="w-full" min={0} value={config.detail.pivot.pivot_start_col}
                onChange={(v) => onChange({ ...config, detail: { ...config.detail, pivot: { ...config.detail.pivot!, pivot_start_col: v ?? 0 } } })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">结束列</label>
              <InputNumber size="small" className="w-full" min={0} value={config.detail.pivot.pivot_end_col}
                onChange={(v) => onChange({ ...config, detail: { ...config.detail, pivot: { ...config.detail.pivot!, pivot_end_col: v ?? undefined } } })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">跳过0值</label>
              <Switch size="small" className="block mt-1" checked={config.detail.pivot.skip_zero_values}
                onChange={(v) => onChange({ ...config, detail: { ...config.detail, pivot: { ...config.detail.pivot!, skip_zero_values: v } } })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">列头映射字段</label>
              <Select size="small" className="w-full" value={config.detail.pivot.pivot_target_field}
                onChange={(v) => onChange({ ...config, detail: { ...config.detail, pivot: { ...config.detail.pivot!, pivot_target_field: v as TargetField } } })}
                options={TARGET_FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">格子值字段</label>
              <Select size="small" className="w-full" value={config.detail.pivot.value_field}
                onChange={(v) => onChange({ ...config, detail: { ...config.detail, pivot: { ...config.detail.pivot!, value_field: v as TargetField } } })}
                options={TARGET_FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">排除关键词(逗号分隔)</label>
              <Input size="small" value={(config.detail.pivot.exclude_patterns ?? []).join(',')}
                onChange={(e) => onChange({ ...config, detail: { ...config.detail, pivot: { ...config.detail.pivot!, exclude_patterns: e.target.value ? e.target.value.split(',') : undefined } } })}
                placeholder="结余,合计" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
