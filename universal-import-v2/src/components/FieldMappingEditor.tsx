'use client';

import React, { useMemo } from 'react';
import { Table, Select, InputNumber, Input, Tag, Tooltip, Space } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { FieldMapping, FieldSource, RuleConfig } from '@/lib/rules/config';
import type { WaybillField } from '@/lib/rules/types';

interface FieldMappingEditorProps {
  config: RuleConfig;
  onChange: (config: RuleConfig) => void;
  preview?: unknown[][]; // 文件预览数据（前几行）
}

const FIELD_LABELS: Record<WaybillField, string> = {
  externalCode: '外部编码',
  storeName: '收货门店',
  receiverName: '收件人姓名',
  receiverPhone: '收件人电话',
  receiverAddress: '收件人地址',
  skuCode: 'SKU编码',
  skuName: 'SKU名称',
  skuQuantity: '发货数量',
  skuSpec: 'SKU规格',
  remark: '备注',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  column: '按列索引',
  columnName: '按列名',
  fixed: '固定值',
  footer: '尾部提取',
  cardHeader: '卡片头',
  regex: '正则提取',
  concat: '拼接',
};

function getSourceDisplay(source: FieldSource): string {
  switch (source.type) {
    case 'column': return `第${source.index + 1}列 (${String.fromCharCode(65 + source.index)}列)`;
    case 'columnName': return `列名: ${source.name}`;
    case 'fixed': return `固定值: ${source.value}`;
    case 'footer': return `尾部字段[${source.fieldIndex}]`;
    case 'cardHeader': return `卡片头[${source.fieldIndex}]`;
    case 'regex': return `正则: ${source.pattern}`;
    case 'concat': return `拼接(${source.sources.length}个来源)`;
    default: return '未知';
  }
}

function getConfidenceTag(confidence?: number) {
  if (confidence === undefined) return null;
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.9) return <Tag color="success">{pct}%</Tag>;
  if (confidence >= 0.7) return <Tag color="warning">{pct}%</Tag>;
  return (
    <Tooltip title="AI对此映射不确定，建议核实">
      <Tag color="error" icon={<WarningOutlined />}>{pct}%</Tag>
    </Tooltip>
  );
}

// 从预览数据推断列头
function getHeaderColumns(preview?: unknown[][], config?: RuleConfig): string[] {
  if (!preview || preview.length === 0) return [];
  const headerRowIdx = config?.dataExtraction && 'headerRow' in config.dataExtraction
    ? config.dataExtraction.headerRow : 0;
  const headerRow = preview[headerRowIdx];
  if (!Array.isArray(headerRow)) return [];
  return headerRow.map((cell, i) => cell ? String(cell) : `列${i + 1}`);
}

export default function FieldMappingEditor({ config, onChange, preview }: FieldMappingEditorProps) {
  const headerColumns = useMemo(() => getHeaderColumns(preview, config), [preview, config]);
  const mappings = config.fieldMapping || [];

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onChange({ ...config, fieldMapping: newMappings });
  };

  const updateSource = (index: number, source: FieldSource) => {
    updateMapping(index, { source });
  };

  const columns = [
    {
      title: '目标字段',
      dataIndex: 'target',
      key: 'target',
      width: 120,
      render: (target: WaybillField) => (
        <span className="font-medium">{FIELD_LABELS[target] || target}</span>
      ),
    },
    {
      title: '来源方式',
      dataIndex: 'source',
      key: 'sourceType',
      width: 130,
      render: (source: FieldSource, _: FieldMapping, index: number) => (
        <Select
          size="small"
          className="w-full"
          value={source.type}
          onChange={(type) => {
            const defaults: Record<string, FieldSource> = {
              column: { type: 'column', index: 0 },
              columnName: { type: 'columnName', name: '' },
              fixed: { type: 'fixed', value: '' },
              footer: { type: 'footer', fieldIndex: 0 },
              cardHeader: { type: 'cardHeader', fieldIndex: 0 },
              regex: { type: 'regex', pattern: '', group: 1 },
              concat: { type: 'concat', sources: [] },
            };
            updateSource(index, defaults[type] || source);
          }}
          options={Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      ),
    },
    {
      title: '来源参数',
      dataIndex: 'source',
      key: 'sourceParam',
      width: 200,
      render: (source: FieldSource, _: FieldMapping, index: number) => {
        switch (source.type) {
          case 'column':
            return (
              <Select
                size="small"
                className="w-full"
                value={source.index}
                onChange={(val) => updateSource(index, { ...source, index: val })}
                options={headerColumns.length > 0
                  ? headerColumns.map((name, i) => ({ value: i, label: `${String.fromCharCode(65 + i)}: ${name}` }))
                  : Array.from({ length: 20 }, (_, i) => ({ value: i, label: `第${i + 1}列 (${String.fromCharCode(65 + i)})` }))
                }
                showSearch
                optionFilterProp="label"
              />
            );
          case 'columnName':
            return (
              <Input
                size="small"
                value={source.name}
                onChange={(e) => updateSource(index, { ...source, name: e.target.value })}
                placeholder="输入列名"
              />
            );
          case 'fixed':
            return (
              <Input
                size="small"
                value={source.value}
                onChange={(e) => updateSource(index, { ...source, value: e.target.value })}
                placeholder="输入固定值"
              />
            );
          case 'footer':
            return (
              <InputNumber
                size="small"
                min={0}
                value={source.fieldIndex}
                onChange={(val) => updateSource(index, { ...source, fieldIndex: val ?? 0 })}
                addonBefore="字段序号"
              />
            );
          case 'regex':
            return (
              <Space.Compact size="small" className="w-full">
                <Input
                  value={source.pattern}
                  onChange={(e) => updateSource(index, { ...source, pattern: e.target.value })}
                  placeholder="正则表达式"
                  style={{ width: '70%' }}
                />
                <InputNumber
                  min={0}
                  value={source.group}
                  onChange={(val) => updateSource(index, { ...source, group: val ?? 1 })}
                  style={{ width: '30%' }}
                  addonBefore="#"
                />
              </Space.Compact>
            );
          default:
            return <span className="text-gray-400 text-xs">{getSourceDisplay(source)}</span>;
        }
      },
    },
    {
      title: '当前映射',
      key: 'display',
      width: 160,
      render: (_: unknown, record: FieldMapping) => (
        <span className="text-xs text-gray-500">{getSourceDisplay(record.source)}</span>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 80,
      render: (confidence?: number) => getConfidenceTag(confidence),
    },
  ];

  // 低置信度警告
  const lowConfidenceCount = mappings.filter(m => m.confidence !== undefined && m.confidence < 0.7).length;

  return (
    <div className="mt-4">
      {lowConfidenceCount > 0 && (
        <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
          <WarningOutlined className="mr-1" />
          有 {lowConfidenceCount} 个字段映射置信度较低，建议核实后再解析
        </div>
      )}
      <Table
        dataSource={mappings.map((m, i) => ({ ...m, _key: i }))}
        columns={columns}
        rowKey="_key"
        size="small"
        pagination={false}
        rowClassName={(record) =>
          record.confidence !== undefined && record.confidence < 0.7 ? 'bg-orange-50' : ''
        }
      />
    </div>
  );
}
