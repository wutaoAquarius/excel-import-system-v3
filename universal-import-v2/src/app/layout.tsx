import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "./globals.css";

export const metadata: Metadata = {
  title: "万能导入 V2 - 物流批量下单系统",
  description: "通过规则引擎+AI辅助解析任意格式文件为结构化运单数据",
};

const theme = {
  token: {
    colorPrimary: "#0fc6c2",
    borderRadius: 12,
    colorBgContainer: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  components: {
    Card: { borderRadiusLG: 16 },
    Button: { borderRadius: 8 },
    Input: { borderRadius: 8 },
    Select: { borderRadius: 8 },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-gray-50">
        <AntdRegistry>
          <ConfigProvider locale={zhCN} theme={theme}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
