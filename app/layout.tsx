import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reelvas',
  description: 'Reelvas — 短剧 AI 无限画布',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
