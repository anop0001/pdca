'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function TopHeader() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(2);

  const isTeam = pathname.startsWith('/team');

  useEffect(() => {
    async function checkPending() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { count, error } = await supabase
          .from('plans')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'check_pending');
        if (!error && count !== null && count > 0) {
          setPendingCount(count);
        }
      } catch {
        // デモ用デフォルト表示(2)を維持
      }
    }
    checkPending();
  }, []);

  return (
    <div className="shrink-0 select-none">
      {/* LINEミニアプリ風 ヘッダーバー */}
      <header className="bg-slate-50/90 backdrop-blur border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 tracking-tight">PDCA Check</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
            LINE MINI APP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="text-[11px] text-slate-400 hover:text-slate-700 transition"
            title="リセット / 再読込"
          >
            リセット
          </button>
          <span className="text-slate-300 text-xs">|</span>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && (window as any).liff) {
                (window as any).liff.closeWindow?.();
              }
            }}
            className="text-xs text-slate-400 hover:text-slate-700 font-mono"
            title="閉じる"
          >
            ✕
          </button>
        </div>
      </header>

      {/* モード切り替えバー (個人PDCA ⇄ チーム管理) */}
      <div className="bg-slate-100/90 p-1.5 border-b border-slate-200 flex gap-1">
        <Link
          href="/"
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
            !isTeam
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👤</span> 個人PDCA
        </Link>
        <Link
          href="/team"
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
            isTeam
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👥</span> チーム管理 (管理者)
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black leading-none">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
