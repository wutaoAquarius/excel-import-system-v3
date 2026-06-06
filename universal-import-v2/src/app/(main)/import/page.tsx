'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Button, Card, Select, Space, message, Progress, Alert, Divider } from 'antd';
import Link from 'next/link';
import { InboxOutlined, RobotOutlined, ThunderboltOutlined, DownloadOutlined, SendOutlined, SaveOutlined } from '@ant-design/icons';
import EditableTable from '@/components/EditableTable';
import FieldMappingEditor from '@/components/FieldMappingEditor';
import type { WaybillRecord } from '@/lib/rules';
import type { RuleConfig } from '@/lib/rules/config';

type Step = 'upload' | 'configure' | 'preview' | 'submitted';

interface RuleItem { id: string; name: string; config: RuleConfig; fileType: string; }

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
  const [parseFailed, setParseFailed] = useState(false);
  const [ruleDirty, setRuleDirty] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setLoading(true); setProgress(20); setParseFailed(false);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData: fileData.rawData, ruleConfig: rule.config }),
      });
      setProgress(80);
      const json = await res.json();
      if (json.error) { message.error(json.error); setParseFailed(true); return; }
      setRecords(json.data.records); setStep('preview'); setProgress(100);
      message.success(`解析完成，共${json.data.totalCount}条记录`);
    } catch { message.error('解析失败'); setParseFailed(true); } finally { setLoading(false); }
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

  // 规则字段映射变更
  const handleRuleConfigChange = useCallback((newConfig: RuleConfig) => {
    if (!selectedRuleId) return;
    setRulesList(prev => prev.map(r =>
      r.id === selectedRuleId ? { ...r, config: newConfig } : r
    ));
    setRuleDirty(true);
  }, [selectedRuleId]);

  // 保存规则到数据库
  const handleSaveRule = useCallback(async () => {
    if (!selectedRuleId) return;
    const rule = rulesList.find(r => r.id === selectedRuleId);
    if (!rule) return;
    setSavingRule(true);
    try {
      const res = await fetch(`/api/rules/${selectedRuleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rule.name, fileType: rule.fileType, config: rule.config }),
      });
      const json = await res.json();
      if (json.error) { message.error(json.error); return; }
      setRuleDirty(false);
      message.success('规则已保存');
    } catch { message.error('保存失败'); } finally { setSavingRule(false); }
  }, [selectedRuleId, rulesList]);

  const handleSubmit = useCallback(async () => {
    if (Object.keys(errors).length > 0) { message.error('请先修正错误数据'); return; }
    setLoading(true); setProgress(0);
    try {
      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, fileName: fileData?.summary.fileName, ruleId: selectedRuleId }),
      });
      setProgress(100);
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
    // 批次内重复检测
    const externalCodeCount: Record<string, number[]> = {};
    data.forEach((r, i) => {
      if (r.externalCode) {
        if (!externalCodeCount[r.externalCode]) externalCodeCount[r.externalCode] = [];
        externalCodeCount[r.externalCode].push(i);
      }
    });
    Object.values(externalCodeCount).filter(indices => indices.length > 1).forEach(indices => {
      indices.forEach(i => {
        if (!errs[i]) errs[i] = {};
        errs[i].externalCode = '外部编码在本批次中重复';
      });
    });
    setErrors(errs);
  }, []);

  const handleDataChange = useCallback((newData: WaybillRecord[]) => {
    setRecords(newData);
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(() => validate(newData), 300);
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
              <Select className="w-full" placeholder="选择已有规则" value={selectedRuleId} onChange={(val) => { setSelectedRuleId(val); setRuleDirty(false); }} options={rulesList.map((r) => ({ label: r.name, value: r.id }))} allowClear />
            </div>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleParse} disabled={!selectedRuleId} loading={loading}>执行解析</Button>
            <Button icon={<RobotOutlined />} onClick={handleAiGenerate} loading={aiLoading}>AI生成规则</Button>
            <Link href="/rules"><Button>管理规则</Button></Link>
          </div>
          {parseFailed && (
            <Alert
              type="warning"
              className="mt-4"
              message="解析失败"
              description={
                <div className="text-sm">
                  <p>文件名：{fileData.summary.fileName}</p>
                  <p>文件类型：{fileData.summary.fileType}</p>
                  <p>数据行数：{fileData.summary.rowsCount}</p>
                  <p className="mt-2">请检查规则配置是否与文件格式匹配，或前往规则管理页面调整。</p>
                  <Link href="/rules"><Button size="small" className="mt-2">前往规则管理</Button></Link>
                </div>
              }
            />
          )}
          {loading && <Progress percent={progress} className="mt-4" strokeColor="#0fc6c2" />}
          {/* 字段映射编辑器：选中规则后显示 */}
          {selectedRuleId && rulesList.find(r => r.id === selectedRuleId) && (
            <>
              <Divider plain className="!mt-5 !mb-3" style={{ fontSize: 13 }}>
                字段映射配置
                {ruleDirty && <span className="text-orange-500 ml-2 text-xs">（已修改未保存）</span>}
              </Divider>
              <FieldMappingEditor
                config={rulesList.find(r => r.id === selectedRuleId)!.config}
                onChange={handleRuleConfigChange}
                preview={fileData?.summary.preview}
              />
              {ruleDirty && (
                <div className="mt-3 flex justify-end">
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveRule} loading={savingRule}>
                    保存规则修改
                  </Button>
                </div>
              )}
            </>
          )}
          <Button type="link" className="mt-2 p-0" onClick={() => { setStep('upload'); setFileData(null); setParseFailed(false); }}>← 重新上传</Button>
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
                <Button icon={<DownloadOutlined />} onClick={handleExport}>导出Excel</Button>
                <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} disabled={Object.keys(errors).length > 0} loading={loading}>提交下单</Button>
              </Space>
            </div>
            {loading && (
              <Progress
                percent={progress}
                className="mb-4"
                strokeColor="#0fc6c2"
                format={(p) => fileData ? `处理中 ${Math.round(((p ?? 0) / 100) * fileData.summary.rowsCount)}/${fileData.summary.rowsCount}条` : `${p}%`}
              />
            )}
            {Object.keys(errors).length > 0 && (
              <Alert
                type="error"
                className="mb-4"
                message={`${Object.keys(errors).length}行有错误`}
                description={
                  <div className="max-h-32 overflow-auto text-xs mt-1">
                    {Object.entries(errors).map(([rowIdx, fields]) => (
                      <div key={rowIdx}>
                        {Object.entries(fields).map(([field, msg]) => (
                          <div key={`${rowIdx}-${field}`}>第{Number(rowIdx) + 1}行 [{field}]: {msg}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                }
              />
            )}
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
