'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';

interface RuleItem { id: string; name: string; description: string; fileType: string; config: unknown; createdAt: string; }

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [form] = Form.useForm();

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rules');
      const json = await res.json();
      if (json.data) setRules(json.data);
    } catch { message.error('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSave = async (values: { name: string; description: string; fileType: string; config: string }) => {
    try {
      const config = JSON.parse(values.config);
      const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules';
      const method = editingRule ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, config }) });
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      message.success(editingRule ? '更新成功' : '创建成功');
      setModalOpen(false); form.resetFields(); setEditingRule(null); loadRules();
    } catch { message.error('配置JSON格式不正确'); }
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
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingRule(record); form.setFieldsValue({ ...record, config: JSON.stringify(record.config, null, 2) }); setModalOpen(true); }}>编辑</Button>
        <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record)}>复制</Button>
        <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}><Button size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div className="space-y-4">
      <Card title="规则管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRule(null); form.resetFields(); setModalOpen(true); }}>新建规则</Button>} className="shadow-sm">
        <Table dataSource={rules} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </Card>
      <Modal title={editingRule ? '编辑规则' : '新建规则'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="fileType" label="文件类型" rules={[{ required: true }]}><Select options={[{ value: 'excel', label: 'Excel' }, { value: 'pdf', label: 'PDF' }, { value: 'word', label: 'Word' }]} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="config" label="规则配置(JSON)" rules={[{ required: true }]}><Input.TextArea rows={12} className="font-mono text-xs" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
