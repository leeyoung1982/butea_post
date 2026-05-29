import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastViewport } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "享寫 — 沉浸式中文写作编辑器",
  description:
    "为中文创作者而生的沉浸式写作工具。一份草稿,AI 原生改写到公众号 / 博客 / X / 小红书 / 微博 / 朋友圈。BYOK,支持 Obsidian 互通,纯前端。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning silences benign attribute diffs on <html>
    // caused by browser extensions (e.g. Immersive Translate / 沉浸式翻译
    // injects `data-immersive-translate-page-theme`). React still hydrates
    // the rest of the tree normally — this only affects the root element.
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
