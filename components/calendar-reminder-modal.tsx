'use client';

import React from 'react';
import { Calendar, Bell, ExternalLink, Download, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getGoogleCalendarUrl, downloadIcsFile, type CalendarEventOptions } from '@/lib/calendar';

interface CalendarReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: CalendarEventOptions;
}

export function CalendarReminderModal({
  isOpen,
  onClose,
  options,
}: CalendarReminderModalProps) {
  if (!isOpen) return null;

  const handleOpenGoogleCalendar = () => {
    const url = getGoogleCalendarUrl(options);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(options);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">カレンダーにリマインド登録</h3>
              <p className="text-[11px] text-slate-500">完全無料・スマホの通知アラーム</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 登録内容のサマリー */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">評価締め切り日</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {options.deadlineDate}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-800 line-clamp-1">{options.title}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>前日および当日に自動アラーム通知</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {/* Google カレンダー */}
          <button
            type="button"
            onClick={handleOpenGoogleCalendar}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-between active:scale-[0.99] transition shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">📅</span>
              <div className="text-left">
                <span className="block font-bold">Google カレンダーに登録</span>
                <span className="text-[10px] text-slate-400 font-normal">ブラウザでGoogleカレンダーを開く</span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </button>

          {/* iPhone / その他カレンダー (.ics) */}
          <button
            type="button"
            onClick={handleDownloadIcs}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-between active:scale-[0.99] transition shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">🍏</span>
              <div className="text-left">
                <span className="block font-bold">iPhone / その他カレンダー</span>
                <span className="text-[10px] text-emerald-100 font-normal">タップして端末カレンダーに追加 (.ics)</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-emerald-100" />
          </button>
        </div>

        {/* 無料案内 */}
        <div className="flex items-start gap-1.5 text-[10px] text-slate-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <span>LINE公式のメッセージ通数制限を消費せず、スマホ本体の通知機能を使って完全無料で期限を忘れずに管理できます。</span>
        </div>
      </div>
    </div>
  );
}
