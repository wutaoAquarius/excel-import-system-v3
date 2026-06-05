'use client';

import React, { useState, useCallback } from 'react';
import { Upload, Button, Card, Select, Space, message, Progress, Alert } from 'antd';
import { InboxOutlined, RobotOutlined, ThunderboltOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import EditableTable from '@/components/EditableTable';
import type { WaybillRecord } from '@/lib/rules';

type Step = 'upload' | 'configure' | 'preview' | 'submitted';

interface RuleItem { id: string; name: string; config: unknown; fileType: string; }

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [fileData, setFileData] = useState<{ summary: { fileName: string; fileSize: number; fileType: string; sheetsCount: number; sheetNames: string[]; rowsCount: number; preview: unknown[][] }; rawData: unknown } | null>(null);
  const [rulesList, setRulesList] = useState<RuleItem[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [records, setRecords] = useState<WaybillRecord[]>([]);
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ successCount: number; failCount: number } | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      const json = await res.json();
      if (json.data) setRulesList(json.data);
    } catch { /* ignore */ }
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true); setProgress(10);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      setProgress(50);
      const json = await res.json();
      if (json.error) { message.error(json.error); return false; }
      setFileData(json.data); setProgress(100);
      await loadRules(); setStep('configure');
      message.success('文件上传成功');
    } catch { message.error('文件上传失败'); } finally { setLoading(false); }
    return false;
  }, [loadRules]);

  const handleParse = useCallback(async () => {
    if (!fileData || !selectedRuleId) { message.warning('请先选择规则'); return; }
    const rule = rulesList.find((r) => r.id === selectedRuleId);
    if (!rule) return;
    setLoading(true); setProgress(20);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData: fileData.rawData, ruleConfig: rule.config }),
      });
      setProgress(80);
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      setRecords(json.data.records); setStep('preview'); setProgress(100);
      message.success(`解析完成，共${json.data.totalCount}条记录`);
    } catch { message.error('解析失败'); } finally { setLoading(false); }
  }, [fileData, selectedRuleId, rulesList]);

  const handleAiGenerate = useCallback(async () => {
    if (!fileData) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: fileData.summary.preview, fileName: fileData.summary.fileName, fileType: fileData.summary.fileType, sheetNames: fileData.summary.sheetNames }),
      });
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      // 保存AI生成的规则
      const saveRes = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `AI规则-${fileData.summary.fileName}`, description: 'AI自动生成', fileType: fileData.summary.fileType, config: json.data.ruleConfig }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.data) {
        await loadRules();
        setSelectedRuleId(saveJson.data.id);
        message.success('AI规则生成成功，已自动选中');
      }
    } catch { message.error('AI规则生成失败'); } finally { setAiLoading(false); }
  }, [fileData, loadRules]);

  const handleSubmit = useCallback(async () => {
    if (Object.keys(errors).length > 0) { message.error('请先修正错误数据'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, fileName: fileData?.summary.fileName, ruleId: selectedRuleId }),
      });
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      setSubmitResult(json.data); setStep('submitted');
      message.success('提交成功');
    } catch { message.error('提交失败'); } finally { setLoading(false); }
  }, [records, errors, fileData, selectedRuleId]);

  const handleExport = useCallback(async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '运单数据');
    XLSX.writeFile(wb, `导出_${fileData?.summary.fileName || 'data'}.xlsx`);
  }, [records, fileData]);

  // 简单校验
  const validate = useCallback((data: WaybillRecord[]) => {
    const errs: Record<number, Record<string, string>> = {};
    data.forEach((r, i) => {
      const rowErr: Record<string, string> = {};
      if (!r.skuCode) rowErr.skuCode = 'SKU编码必填';
      if (!r.skuName) rowErr.skuName = 'SKU名称必填';
      if (!r.skuQuantity || r.skuQuantity <= 0) rowErr.skuQuantity = '数量必须为正数';
      if (!r.storeName && !(r.receiverName && r.receiverPhone && r.receiverAddress)) {
        if (!r.storeName) rowErr.storeName = '收货门店或收件人信息必填';
      }
      if (r.receiverPhone && !/^1\d{10}$/.test(r.receiverPhone)) rowErr.receiverPhone = '电话格式不正确';
      if (Object.keys(rowErr).length > 0) errs[i] = rowErr;
    });
    setErrors(errs);
  }, []);

  const handleDataChange = useCallback((newData: WaybillRecord[]) => {
    setRecords(newData);
    validate(newData);
  }, [validate]);

  return (
    <div className="space-y-4">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card title="上传文件" className="shadow-sm">
          <Upload.Dragger accept=".xlsx,.xls,.pdf,.docx" beforeUpload={handleUpload} showUploadList={false}>
            <p className="text-4xl text-[#0fc6c2]"><InboxOutlined /></p>
            <p className="text-base mt-2">点击或拖拽文件到此区域上传</p>
            <p className="text-gray-400 text-sm">支持 Excel(.xlsx/.xls)、PDF、Word(.docx)</p>
          </Upload.Dragger>
          {loading && <Progress percent={progress} className="mt-4" strokeColor="#0fc6c2" />}
        </Card>
      )}

      {/* Step 2: Configure rule */}
      {step === 'configure' && fileData && (
        <Card title={`配置规则 - ${fileData.summary.fileName}`} className="shadow-sm">
          <Alert message={`文件信息: ${fileData.summary.sheetsCount}个Sheet, ${fileData.summary.rowsCount}行数据`} type="info" className="mb-4" />
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">选择解析规则</label>
              <Select className="w-full" placeholder="选择已有规则" value={selectedRuleId} onChange={setSelectedRuleId} options={rulesList.map((r) => ({ label: r.name, value: r.id }))} allowClear />
            </div>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleParse} disabled={!selectedRuleId} loading={loading}>执行解析</Button>
            <Button icon={<RobotOutlined />} onClick={handleAiGenerate} loading={aiLoading}>AI生成规则</Button>
          </div>
          {loading && <Progress percent={progress} className="mt-4" strokeColor="#0fc6c2" />}
          <Button type="link" className="mt-2 p-0" onClick={() => { setStep('upload'); setFileData(null); }}>← 重新上传</Button>
        </Card>
      )}

      {/* Step 3: Preview & Edit */}
      {step === 'preview' && (
        <>
          <Card className="shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Space>
                <Button onClick={() => setStep('configure')}>← 返回配置</Button>
                <span className="text-sm text-gray-500">{fileData?.summary.fileName}</span>
              </Space>
              <Space>
                {Object.keys(errors).length > 0 && <Alert message={`${Object.keys(errors).length}行有错误`} type="error" banner className="!py-1" />}
                <Button icon={<DownloadOutlined />} onClick={handleExport}>导出Excel</Button>
                <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} disabled={Object.keys(errors).length > 0} loading={loading}>提交下单</Button>
              </Space>
            </div>
            <EditableTable data={records} onChange={handleDataChange} errors={errors} />
          </Card>
        </>
      )}

      {/* Step 4: Submitted */}
      {step === 'submitted' && submitResult && (
        <Card className="shadow-sm text-center py-8">
          <div className="text-5xl text-[#0fc6c2] mb-4">✓</div>
          <h2 className="text-xl font-medium mb-2">提交成功</h2>
          <p>成功: {submitResult.successCount} 条 | 失败: {submitResult.failCount} 条</p>
          <Button type="primary" className="mt-4" onClick={() => { setStep('upload'); setFileData(null); setRecords([]); setSubmitResult(null); }}>继续导入</Button>
        </Card>
      )}
    </div>
  );
}
