'use client';

import React, { useState } from 'react';
import { RotateCw, Wrench, Compass, CheckCircle2, ChevronRight, X, Loader2, Calendar, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';
import { CalendarReminderModal } from '@/components/calendar-reminder-modal';

export type ActionType = 'continue' | 'revise' | 'alternative' | 'terminate';

interface ActionSelectorProps {
  currentCriteria: {
    actionPlan: string;
    targetValue: number;
    unit: string;
    operator: 'gte' | 'lte' | 'eq';
    frequency: string;
    deadline: string;
    versionNumber: number;
  };
  onConfirmAction: (
    actionType: ActionType,
    revisionData?: {
      actionPlan: string;
      targetValue: number;
      unit: string;
      operator: 'gte' | 'lte' | 'eq';
      frequency: string;
      deadline: string;
    }
  ) => Promise<void>;
  isSubmitting: boolean;
  checkStatus?: 'achieved' | 'unachieved' | 'unrecorded';
  actualStats?: {
    recordedDays: number;
    totalDays: number;
    averageValue: number;
  };
}

export function ActionSelector({
  currentCriteria,
  onConfirmAction,
  isSubmitting,
  checkStatus,
  actualStats,
}: ActionSelectorProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>('continue');
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const [revActionPlan, setRevActionPlan] = useState(currentCriteria.actionPlan);
  const [revTargetValue, setRevTargetValue] = useState(currentCriteria.targetValue);
  const [revUnit, setRevUnit] = useState(currentCriteria.unit);
  const [revOperator, setRevOperator] = useState(currentCriteria.operator);
  const [revFrequency, setRevFrequency] = useState(currentCriteria.frequency);
  const defaultNextDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const [revDeadline, setRevDeadline] = useState(defaultNextDeadline);

  const isUnrecorded = checkStatus === 'unrecorded' || actualStats?.recordedDays === 0;

  const ACTION_OPTIONS = [
    {
      type: 'continue' as ActionType,
      title: '継続する',
      badge: isUnrecorded ? '習慣化を優先' : '同じ条件で継続',
      desc: isUnrecorded
        ? '前回の目標・条件を変えずに再挑戦し、まずは日々の記録をつける習慣を作ります（おすすめ）。'
        : '効果が出ている、またはもう少し検証を続けるため、このまま次の期間へ進みます。',
      icon: RotateCw,
      color: 'border-blue-200 hover:border-blue-400 bg-blue-50/40 text-blue-900',
      activeColor: 'border-blue-500 bg-blue-50 ring-2 ring-blue-400',
    },
    {
      type: 'revise' as ActionType,
      title: '修正する (Ver.UP)',
      badge: `Ver.${currentCriteria.versionNumber + 1} へ改訂`,
      desc: isUnrecorded
        ? '記録しにくかった、または目標設定が生活に合わなかったため、行動内容や期日を見直します。'
        : '目標値が高すぎた・行動が合わなかったため、実行内容や数値を現実的に見直します。',
      icon: Wrench,
      color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 text-emerald-900',
      activeColor: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400',
    },
    {
      type: 'alternative' as ActionType,
      title: '別の手段を試す',
      badge: '新Planを立ち上げ',
      desc: '上位の目的は変えず、全く別のアプローチ・実行計画を新規作成して挑戦します。',
      icon: Compass,
      color: 'border-purple-200 hover:border-purple-400 bg-purple-50/40 text-purple-900',
      activeColor: 'border-purple-500 bg-purple-50 ring-2 ring-purple-400',
    },
    {
      type: 'terminate' as ActionType,
      title: '終了する',
      badge: 'Planクローズ',
      desc: '目標を完全にクリアした、またはこの取り組みを一度完了として整理します。',
      icon: CheckCircle2,
      color: 'border-gray-200 hover:border-gray-400 bg-gray-50/60 text-gray-800',
      activeColor: 'border-gray-500 bg-gray-100 ring-2 ring-gray-400',
    },
  ];

  const handleMainSubmit = () => {
    if (selectedAction === 'revise') {
      setShowReviseModal(true);
    } else {
      onConfirmAction(selectedAction);
    }
  };

  const handleSaveRevision = () => {
    setShowReviseModal(false);
    onConfirmAction('revise', {
      actionPlan: revActionPlan,
      targetValue: revTargetValue,
      unit: revUnit,
      operator: revOperator,
      frequency: revFrequency,
      deadline: revDeadline,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div>
        <h2 className="text-base font-bold text-gray-900">
          次の方針を決定してください (Action)
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          反省文は不要です。客観的な結果をもとに、次の一手を選択してください。
        </p>
      </div>

      <div className="space-y-2.5">
        {ACTION_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedAction === opt.type;
          return (
            <div
              key={opt.type}
              onClick={() => setSelectedAction(opt.type)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition active:scale-[0.99] ${
                isSelected ? opt.activeColor : opt.color
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-sm">{opt.title}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current">
                  {opt.badge}
                </span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed pl-6">{opt.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleMainSubmit}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 disabled:opacity-50 transition"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              処理中...
            </>
          ) : (
            <>
              この方針で確定して次へ進む
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {showReviseModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Planの改訂 (Ver.{currentCriteria.versionNumber + 1})
                </h3>
                <p className="text-xs text-gray-500">
                  過去のVer.{currentCriteria.versionNumber}は履歴に残り、上書きされません。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 transition"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">
                実行内容 (アクション)
              </label>
              <textarea
                rows={2}
                value={revActionPlan}
                onChange={(e) => setRevActionPlan(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* 前回の実績とズレの診断アラート */}
            {isUnrecorded ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>想定と実績のズレ：未記録（記録0日）</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  前Ver.は実績の記録がありませんでした。目標数値を引き上げる前に、まずは「同じ数値で記録をつける習慣化」や「リマインド通知」の活用を検討してください。
                </p>
              </div>
            ) : revTargetValue > currentCriteria.targetValue && checkStatus === 'unachieved' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>💡 改善アドバイス（目標引き上げの確認）</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  前回未達成の状態で目標数値（{currentCriteria.targetValue} → {revTargetValue}{revUnit}）を引き上げようとしています。PDCAでは、まずは前回の想定と実績のズレを埋め、達成体験を積んでから数値を上げるのが継続のコツです。
                </p>
              </div>
            ) : revTargetValue < currentCriteria.targetValue && checkStatus === 'unachieved' ? (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  現実的な数値に調整し、まずは確実に達成できるリズムを作りましょう！
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">目標数値</label>
                <input
                  type="number"
                  value={revTargetValue}
                  onChange={(e) => setRevTargetValue(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-center font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">単位</label>
                <input
                  type="text"
                  value={revUnit}
                  onChange={(e) => setRevUnit(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-center text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {revTargetValue > currentCriteria.targetValue && isUnrecorded && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-1.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  未記録の状態で目標数値を引き上げています（{currentCriteria.targetValue} → {revTargetValue}{revUnit}）。まずは前Ver.と同じ数値で記録を継続するか、ハードルを下げることをおすすめします。
                </span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">次の評価期限</label>
              <input
                type="date"
                value={revDeadline}
                onChange={(e) => setRevDeadline(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* カレンダー予定の注意案内 */}
            <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-2xl text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Googleカレンダーの予定についてのご案内</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                このPlanにはカレンダー登録用の予定があります。以前の予定を確認し、必要に応じて変更してください。
              </p>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-amber-700/80">
                  ※Ver.{currentCriteria.versionNumber}の予定は自動更新されません
                </span>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                >
                  <span>Googleカレンダーを開く</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* カレンダー連携（完全無料通知） */}
            <button
              type="button"
              onClick={() => setShowCalendarModal(true)}
              className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>新Ver.の期日をカレンダーに登録</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">無料</span>
            </button>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleSaveRevision}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                Ver.{currentCriteria.versionNumber + 1} として新規保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カレンダーリマインドモーダル */}
      <CalendarReminderModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        options={{
          title: revActionPlan || 'Plan目標アクション',
          targetValue: revTargetValue,
          unit: revUnit,
          frequency: revFrequency || currentCriteria.frequency || 'daily',
          deadlineDate: revDeadline,
          isRevision: true,
        }}
      />
    </div>
  );
}
