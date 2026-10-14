import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LiffProvider } from '@/components/liff-provider';
import { BottomNav } from '@/components/bottom-nav';
import { TopHeader } from '@/components/top-header';

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
            {/* ANOP公式への導線バナー（緑バーに白テキスト） */}
            <a
              href="https://anop.info"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2 px-3 text-xs font-bold flex items-center justify-center gap-1 transition shadow-sm select-none shrink-0"
            >
              <span>シンプルPDCA管理 for ANOP</span>
              <svg className="w-3 h-3 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* ヘッダー & モード切り替えバー (個人PDCA ⇄ チーム管理) */}
            <TopHeader />

            <main className="flex-1 p-4">{children}</main>
            <BottomNav />
          </div>
        </LiffProvider>
      </body>
    </html>
  );
}
