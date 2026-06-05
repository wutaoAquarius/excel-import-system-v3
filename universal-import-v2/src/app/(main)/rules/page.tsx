'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Upload, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { RuleConfig, FieldMapping } from '@/lib/rules/config';

interface RuleItem { id: string; name: string; description: string; fileType: string; config: unknown; createdAt: string; }

// 解析结果预览行类型
interface PreviewRecord { [key: string]: string | number | undefined; }

// 置信度 Tag 颜色
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'warning';
  return 'error';
}

// 从 config JSON 字符串中提取字段映射置信度信息
function parseFieldMappings(configJson: string): FieldMapping[] {
  try {
    const config = JSON.parse(configJson) as RuleConfig;
    return Array.isArray(config.fieldMapping) ? config.fieldMapping : [];
  } catch {
    return [];
  }
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<PreviewRecord[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rules');
      const json = await res.json();
      if (json.data) setRules(json.data);
    } catch { message.error('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  // 测试文件上传并调用解析
  const handleTestFile: UploadProps['beforeUpload'] = async (file) => {
    setTestLoading(true);
    setTestResult([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadJson = await uploadRes.json();
      if (uploadJson.error) { message.error(uploadJson.error); return false; }

      const currentConfig = editingConfig || form.getFieldValue('config') || '';
      let ruleConfig: RuleConfig;
      try {
        ruleConfig = JSON.parse(currentConfig) as RuleConfig;
      } catch {
        message.error('规则配置JSON格式不正确，请先修正后再测试');
        return false;
      }

      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData: uploadJson.data.rawData, ruleConfig }),
      });
      const parseJson = await parseRes.json();
      if (parseJson.error) { message.error(parseJson.error); return false; }
      if (parseJson.data) setTestResult(parseJson.data.records.slice(0, 10));
    } catch { message.error('测试失败，请检查网络或配置');
    } finally { setTestLoading(false); }
    return false;
  };

  const handleSave = async (values: { name: string; description: string; fileType: string; config: string }) => {
    try {
      const config = JSON.parse(values.config);
      const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules';
      const method = editingRule ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, config }) });
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      message.success(editingRule ? '更新成功' : '创建成功');
      setModalOpen(false); form.resetFields(); setEditingRule(null);
      setTestResult([]); setEditingConfig('');
      loadRules();
    } catch { message.error('配置JSON格式不正确'); }
  };

  const openModal = (rule: RuleItem | null) => {
    setTestResult([]);
    setEditingRule(rule);
    if (rule) {
      const configStr = JSON.stringify(rule.config, null, 2);
      form.setFieldsValue({ ...rule, config: configStr });
      setEditingConfig(configStr);
    } else {
      form.resetFields();
      setEditingConfig('');
    }
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    message.success('已删除'); loadRules();
  };

  const handleCopy = async (rule: RuleItem) => {
    await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${rule.name} (副本)`, description: rule.description, fileType: rule.fileType, config: rule.config }) });
    message.success('已复制'); loadRules();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '文件类型', dataIndex: 'fileType', key: 'fileType', render: (t: string) => <Tag color="cyan">{t}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
    { title: '操作', key: 'action', render: (_: unknown, record: RuleItem) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>编辑</Button>
        <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record)}>复制</Button>
        <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}><Button size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div className="space-y-4">
      <Card title="规则管理" extra={        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>新建规则</Button>} className="shadow-sm">
        <Table dataSource={rules} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </Card>
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setTestResult([]); setEditingConfig(''); }}
        onOk={() => form.submit()}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="fileType" label="文件类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'excel', label: 'Excel' }, { value: 'pdf', label: 'PDF' }, { value: 'word', label: 'Word' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="config" label="规则配置(JSON)" rules={[{ required: true }]}>
            <Input.TextArea
              rows={12}
              className="font-mono text-xs"
              onChange={(e) => setEditingConfig(e.target.value)}
            />
          </Form.Item>
        </Form>

        {/* 字段映射置信度展示 */}
        {parseFieldMappings(editingConfig).some((fm) => fm.confidence !== undefined) && (
          <div className="mt-2 mb-3">
            <Divider plain style={{ fontSize: 12 }}>字段映射置信度</Divider>
            <Space wrap size={[4, 4]}>
              {parseFieldMappings(editingConfig).map((fm, idx) =>
                fm.confidence !== undefined ? (
                  <Tag key={idx} color={getConfidenceColor(fm.confidence)}>
                    {fm.target}：{(fm.confidence * 100).toFixed(0)}%
                  </Tag>
                ) : null
              )}
            </Space>
          </div>
        )}

        {/* 测试文件上传区 */}
        <Divider plain style={{ fontSize: 12 }}>规则预览测试</Divider>
        <Upload
          accept=".xlsx,.xls,.pdf,.docx,.doc"
          beforeUpload={handleTestFile}
          showUploadList={false}
          disabled={testLoading}
        >
          <Button icon={<UploadOutlined />} loading={testLoading} size="small">
            上传测试文件（前10条预览）
          </Button>
        </Upload>

        {/* 解析结果预览 */}
        {testResult.length > 0 && (
          <div className="mt-3">
            <Divider plain style={{ fontSize: 12 }}>
              解析结果（共 {testResult.length} 条）
            </Divider>
            <Table
              dataSource={testResult.map((row, i) => ({ ...row, _key: i }))}
              rowKey="_key"
              size="small"
              scroll={{ x: true }}
              pagination={false}
              columns={Object.keys(testResult[0])
                .filter((k) => k !== '_key')
                .map((k) => ({ title: k, dataIndex: k, key: k, ellipsis: true }))}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
