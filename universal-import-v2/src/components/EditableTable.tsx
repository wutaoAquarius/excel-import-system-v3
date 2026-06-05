'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { WaybillRecord } from '@/lib/rules';
import { Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

interface EditableTableProps {
  data: WaybillRecord[];
  onChange: (data: WaybillRecord[]) => void;
  errors?: Record<number, Record<string, string>>;
}

const COLUMNS: { key: keyof WaybillRecord; title: string; width: number }[] = [
  { key: 'externalCode', title: '外部编码', width: 140 },
  { key: 'storeName', title: '收货门店', width: 180 },
  { key: 'receiverName', title: '收件人', width: 100 },
  { key: 'receiverPhone', title: '电话', width: 130 },
  { key: 'receiverAddress', title: '地址', width: 240 },
  { key: 'skuCode', title: 'SKU编码', width: 130 },
  { key: 'skuName', title: 'SKU名称', width: 200 },
  { key: 'skuQuantity', title: '数量', width: 80 },
  { key: 'skuSpec', title: '规格型号', width: 150 },
  { key: 'remark', title: '备注', width: 150 },
];

export default function EditableTable({ data, onChange, errors }: EditableTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const updateCell = useCallback(
    (rowIndex: number, colKey: string, value: string) => {
      const newData = [...data];
      newData[rowIndex] = { ...newData[rowIndex], [colKey]: colKey === 'skuQuantity' ? (parseFloat(value) || 0) : value };
      onChange(newData);
    },
    [data, onChange]
  );

  const addRow = useCallback(() => {
    onChange([...data, { skuCode: '', skuName: '', skuQuantity: 0 } as WaybillRecord]);
  }, [data, onChange]);

  const deleteRow = useCallback((index: number) => {
    onChange(data.filter((_, i) => i !== index));
  }, [data, onChange]);

  const columnHelper = createColumnHelper<WaybillRecord>();
  const columns = COLUMNS.map((col) =>
    columnHelper.accessor(col.key, {
      header: col.title,
      size: col.width,
      cell: ({ row, getValue }) => {
        const rowIdx = row.index;
        const value = String(getValue() ?? '');
        const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key;
        const hasError = errors?.[rowIdx]?.[col.key];

        if (isEditing) {
          return (
            <input
              className="w-full h-full px-2 py-1 border-2 border-[#0fc6c2] outline-none bg-white text-sm"
              defaultValue={value}
              autoFocus
              onBlur={(e) => {
                updateCell(rowIdx, col.key, e.target.value);
                setEditingCell(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  updateCell(rowIdx, col.key, (e.target as HTMLInputElement).value);
                  // 移动到下一个单元格
                  const colIdx = COLUMNS.findIndex((c) => c.key === col.key);
                  const nextCol = COLUMNS[colIdx + 1];
                  if (nextCol) {
                    setEditingCell({ row: rowIdx, col: nextCol.key });
                  } else if (rowIdx < data.length - 1) {
                    setEditingCell({ row: rowIdx + 1, col: COLUMNS[0].key });
                  } else {
                    setEditingCell(null);
                  }
                }
                if (e.key === 'Escape') setEditingCell(null);
              }}
            />
          );
        }

        return (
          <div
            className={`px-2 py-1 h-full cursor-pointer text-sm truncate ${hasError ? 'bg-red-50 border border-red-300' : ''}`}
            onClick={() => setEditingCell({ row: rowIdx, col: col.key })}
            title={hasError || value}
          >
            {value || <span className="text-gray-300">-</span>}
          </div>
        );
      },
    })
  );

  const table = useReactTable({
    data,
    columns: columns as ColumnDef<WaybillRecord, unknown>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36,
    overscan: 20,
  });

  const totalWidth = COLUMNS.reduce((acc, col) => acc + col.width, 0) + 60;

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm text-gray-600">共 {data.length} 条记录</span>
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addRow}>新增行</Button>
        </Space>
      </div>

      {/* Table */}
      <div ref={tableContainerRef} className="overflow-auto" style={{ maxHeight: '600px' }}>
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="flex sticky top-0 bg-gray-100 z-10 border-b">
            <div className="w-[60px] flex-shrink-0 px-2 py-2 text-xs font-medium text-gray-500 border-r">操作</div>
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className="px-2 py-2 text-xs font-medium text-gray-700 border-r"
                style={{ width: col.width, flexShrink: 0 }}
              >
                {col.title}
              </div>
            ))}
          </div>

          {/* Virtual Rows */}
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  className="flex absolute w-full border-b hover:bg-blue-50"
                  style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="w-[60px] flex-shrink-0 flex items-center justify-center border-r">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => deleteRow(virtualRow.index)}
                    />
                  </div>
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="border-r flex items-center"
                      style={{ width: cell.column.getSize(), flexShrink: 0 }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
