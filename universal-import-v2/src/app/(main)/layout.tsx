'use client';

import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
  ImportOutlined,
  SettingOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/import', icon: <ImportOutlined />, label: '文件导入' },
  { key: '/rules', icon: <SettingOutlined />, label: '规则管理' },
  { key: '/orders', icon: <OrderedListOutlined />, label: '运单列表' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout className="min-h-screen">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-100">
          <Title level={5} className="!mb-0 !text-[#0fc6c2]">
            {collapsed ? '导入' : '万能导入 V2'}
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header className="!bg-white !px-6 border-b border-gray-100 flex items-center">
          <Title level={4} className="!mb-0 text-gray-800">
            物流批量下单系统
          </Title>
        </Header>
        <Content className="p-6">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
