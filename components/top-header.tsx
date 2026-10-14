'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen } from 'lucide-react';

export function TopHeader() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const isTeam = pathname.startsWith('/team');

  useEffect(() => {
    function updateBadge() {
      try {
        const cachedTasks = localStorage.getItem('pdca_team_tasks');
        if (cachedTasks) {
          const list = JSON.parse(cachedTasks);
          const pending = list.filter((t: any) => t.status === 'check_pending').length;
          setPendingCount(pending);
          return;
        }
      } catch {}
      setPendingCount(0);
    }

    updateBadge();
    window.addEventListener('storage', updateBadge);
    window.addEventListener('pdca_tasks_updated', updateBadge);
    return () => {
      window.removeEventListener('storage', updateBadge);
      window.removeEventListener('pdca_tasks_updated', updateBadge);
    };
  }, []);

  return (
    <div className="shrink-0 select-none">
      <header className="bg-slate-50/90 backdrop-blur border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 tracking-tight">PDCA Check</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
            LINE MINI APP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/help"
            className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full transition active:scale-95"
            title="使い方マニュアル"
          >
            <BookOpen className="w-3 h-3 text-emerald-600" />
            <span>マニュアル</span>
          </Link>
          <span className="text-slate-300 text-xs">|</span>
          <button onClick={() => window.location.reload()} className="text-[11px] text-slate-400 hover:text-slate-700">更新</button>
        </div>
      </header>

      <div className="bg-slate-100/90 p-1.5 border-b border-slate-200 flex gap-1">
        <Link
          href="/"
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
            !isTeam ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👤</span> 個人PDCA
        </Link>
        <Link
          href="/team"
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
            isTeam ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👥</span> チーム管理 (管理者)
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black leading-none animate-in zoom-in duration-150">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
