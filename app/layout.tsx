import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LiffProvider } from '@/components/liff-provider';
import { BottomNav } from '@/components/bottom-nav';

export const metadata: Metadata = {
  title: 'PDCA Check - 改善し続ける目標管理',
  description: 'LINEミニアプリで動作するPDCAサイクル改善管理ツール',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-800 antialiased min-h-screen">
        <LiffProvider>
          <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white shadow-sm pb-16">
            <main className="flex-1 p-4">{children}</main>
            <BottomNav />
          </div>
        </LiffProvider>
      </body>
    </html>
  );
}
