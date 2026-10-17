'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Bell, ExternalLink, X, ShieldCheck, Clock, Check, Sparkles, RefreshCw, Info } from 'lucide-react';
import {
  getGoogleCalendarUrl,
  type CalendarEventOptions,
  type TimeSlot,
  TIME_SLOT_CONFIG,
  FREQUENCY_CONFIG,
} from '@/lib/calendar';

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
  const initialFreq = options.frequency || 'daily';
  const [frequency, setFrequency] = useState<string>(initialFreq);
  const [mode, setMode] = useState<'action' | 'deadline'>(initialFreq === 'single' ? 'deadline' : 'action');
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('morning');
  const [customStartTime, setCustomStartTime] = useState<string>('09:00');
  const [customDuration, setCustomDuration] = useState<number>(30);

  useEffect(() => {
    if (options.frequency) {
      setFrequency(options.frequency);
      if (options.frequency === 'single') {
        setMode('deadline');
      } else {
        setMode('action');
      }
    }
  }, [options.frequency]);

  if (!isOpen) return null;

  const freqCfg = FREQUENCY_CONFIG[frequency] || FREQUENCY_CONFIG.daily;

  const handleOpenGoogleCalendar = () => {
    const url = getGoogleCalendarUrl({
      ...options,
      frequency,
      mode,
      timeSlot,
      customStartTime,
      customDurationMinutes: customDuration,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getSlotDisplayLabel = () => {
    if (timeSlot === 'all_day') return '終日タスク（時間指定なし）';
    if (timeSlot === 'custom') return `${customStartTime} 〜 (${customDuration}分間)`;
    const cfg = TIME_SLOT_CONFIG[timeSlot];
    return cfg ? `${cfg.label} ${cfg.start}〜${cfg.end}` : '09:00〜09:30';
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3.5 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">カレンダーにリマインド登録</h3>
              <p className="text-[10px] text-slate-500">完全無料・スマホの通知アラーム</p>
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

        {/* 改訂時の案内 */}
        {options.isRevision && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
              <span>以前の予定の確認・変更について</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              このPlanにはカレンダー登録用の予定があります。以前の予定を確認し、必要に応じて変更してください。
            </p>
            <p className="text-[10px] text-amber-700/80 leading-normal">
              ※Googleカレンダー等の以前の予定は自動更新されません。カレンダー側で以前の予定をご確認・ご調整ください。
            </p>
          </div>
        )}

        {/* モード切替タブ（行動ベース vs 締め切り日） */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('action');
              if (frequency === 'single') setFrequency('daily');
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
              mode === 'action'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{freqCfg.tabLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('deadline')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
              mode === 'deadline'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>最終評価期日のみ</span>
          </button>
        </div>

        {/* 行動ベース設定画面 */}
        {mode === 'action' ? (
          <div className="space-y-3">
            {/* 行動目標のサマリー */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                  <span>行動リマインド（{freqCfg.badge}）</span>
                </span>
                {options.deadlineDate && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    〜 {options.deadlineDate}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-emerald-950 line-clamp-2">{options.title}</p>
              {options.targetValue && (
                <p className="text-[11px] text-emerald-800 font-medium">
                  目標: {freqCfg.label} {options.targetValue}{options.unit || '回'}
                </p>
              )}
            </div>

            {/* 実行頻度の選択（目標設定と完全連動） */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-emerald-600" />
                  <span>実行頻度（連動）</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Plan設定と連動中
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'daily', label: '毎日' },
                  { id: 'weekday', label: '平日のみ' },
                  { id: 'weekly', label: '毎週' },
                  { id: 'single', label: '期日までに1度' },
                ].map((item) => {
                  const isMatch = frequency === item.id || (frequency === 'weekdays' && item.id === 'weekday');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFrequency(item.id);
                        if (item.id === 'single') {
                          setMode('deadline');
                        }
                      }}
                      className={`py-2 px-2 text-xs rounded-xl border text-center transition ${
                        isMatch
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-500 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 時間帯スロット選択 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>実行する時間帯（枠）を選択</span>
              </label>

              {/* 4つのプリセット */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(TIME_SLOT_CONFIG) as [Exclude<TimeSlot, 'custom' | 'all_day'>, typeof TIME_SLOT_CONFIG[keyof typeof TIME_SLOT_CONFIG]][]).map(
                  ([key, cfg]) => {
                    const isSelected = timeSlot === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTimeSlot(key)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {cfg.start} 〜 {cfg.end}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              {/* 終日予定 & 時間指定 */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setTimeSlot('all_day')}
                  className={`py-2 px-2.5 rounded-xl border text-center text-xs font-bold transition ${
                    timeSlot === 'all_day'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📅 終日タスク
                </button>

                <button
                  type="button"
                  onClick={() => setTimeSlot('custom')}
                  className={`py-2 px-2.5 rounded-xl border text-center text-xs font-bold transition ${
                    timeSlot === 'custom'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ⏰ 時間を指定
                </button>
              </div>

              {/* カスタム時間入力 */}
              {timeSlot === 'custom' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">開始時刻:</span>
                    <input
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">所要時間:</span>
                    <div className="flex gap-1">
                      {[15, 30, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setCustomDuration(mins)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                            customDuration === mins
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600'
                          }`}
                        >
                          {mins}分
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* プレビュー表示 */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
              <span className="font-bold text-slate-700 block">予定内容プレビュー:</span>
              <span className="font-semibold text-emerald-900">{freqCfg.label} {getSlotDisplayLabel()}</span>
              {options.deadlineDate && (
                <span className="text-slate-400 block text-[10px] mt-0.5">
                  ※締め切り期日（{options.deadlineDate}）まで【{freqCfg.badge}】としてGoogleカレンダーに登録されます
                </span>
              )}
            </div>
          </div>
        ) : (
          /* 締め切り日単発モード */
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">評価締め切り日</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {options.deadlineDate || '未設定'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 line-clamp-1">{options.title}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span>最終締め切り日の評価リマインドとして1日登録</span>
              </div>
            </div>
          </div>
        )}

        {/* Googleカレンダー登録ボタン */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleOpenGoogleCalendar}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-between active:scale-[0.99] transition shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">📅</span>
              <div className="text-left">
                <span className="block font-bold">
                  {mode === 'action' ? `Google カレンダーに【${freqCfg.label}枠】を登録` : 'Google カレンダーに期日を登録'}
                </span>
                <span className="text-[10px] text-emerald-100 font-normal">
                  {mode === 'action' ? `タップしてGoogleカレンダーに${freqCfg.badge}で追加` : 'タップして評価期日に追加'}
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-emerald-100" />
          </button>
        </div>

        {/* 無料案内 */}
        <div className="flex items-start gap-1.5 text-[10px] text-slate-400 pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            LINE公式の有料メッセージ通数を一切消費せず、スマホ本体のカレンダー通知で行動時間を確実に確保して習慣化できます。
          </span>
        </div>
      </div>
    </div>
  );
}
