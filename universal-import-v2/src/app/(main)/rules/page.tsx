'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Divider } from 'antd';
import { EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import type { RuleConfig } from '@/lib/rules/config';
import { FIELD_LABELS } from '@/lib/rules/config';
import RuleConfigEditor from '@/components/RuleConfigEditor';

interface RuleItem { id: string; name: string; description: string; fileType: string; config: RuleConfig; createdAt: string; }

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [editConfig, setEditConfig] = useState<RuleConfig | null>(null);
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

  const handleSave = async (values: { name: string; description: string; fileType: string }) => {
    if (!editingRule || !editConfig) return;
    try {
      const res = await fetch(`/api/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, config: editConfig }),
      });
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      message.success('更新成功');
      setModalOpen(false); form.resetFields(); setEditingRule(null); setEditConfig(null);
      loadRules();
    } catch { message.error('保存失败'); }
  };

  const openModal = (rule: RuleItem) => {
    setEditingRule(rule);
    setEditConfig(JSON.parse(JSON.stringify(rule.config)));
    form.setFieldsValue({ name: rule.name, description: rule.description, fileType: rule.fileType });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    message.success('已删除'); loadRules();
  };

  const handleCopy = async (rule: RuleItem) => {
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${rule.name} (副本)`, description: rule.description, fileType: rule.fileType, config: rule.config }),
    });
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
      <Card title="规则管理" className="shadow-sm">
        <Table dataSource={rules} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </Card>
      <Modal
        title="编辑规则"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingRule(null); setEditConfig(null); }}
        onOk={() => form.submit()}
        width={1000}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="fileType" label="文件类型" rules={[{ required: true }]}>
              <Select options={[{ value: 'excel', label: 'Excel' }, { value: 'pdf', label: 'PDF' }]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>

        {editConfig && (
          <>
            <Divider plain style={{ fontSize: 13 }}>规则配置（可编辑）</Divider>
            <RuleConfigEditor config={editConfig} onChange={setEditConfig} />
          </>
        )}
      </Modal>
    </div>
  );
}
