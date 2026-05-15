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
  title: "Butea — 不负每一份灵感",
  description:
    "AI 原生的开源内容创作 OS。一份草稿,适配每个平台 —— 公众号 / 博客 / X / 小红书 / 微博 / 朋友圈,改结构、改语气、改排版,不动语言。BYOK,对接 Obsidian。Live up to every inspiration.",
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
