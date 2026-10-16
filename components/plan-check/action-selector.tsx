'use client';

import React, { useState } from 'react';
import { RotateCw, Wrench, Compass, CheckCircle2, ChevronRight, X, Loader2, Calendar } from 'lucide-react';
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
}

export function ActionSelector({
  currentCriteria,
  onConfirmAction,
  isSubmitting,
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

  const ACTION_OPTIONS = [
    {
      type: 'continue' as ActionType,
      title: '継続する',
      badge: '同じ条件で継続',
      desc: '効果が出ている、またはもう少し検証を続けるため、このまま次の期間へ進みます。',
      icon: RotateCw,
      color: 'border-blue-200 hover:border-blue-400 bg-blue-50/40 text-blue-900',
      activeColor: 'border-blue-500 bg-blue-50 ring-2 ring-blue-400',
    },
    {
      type: 'revise' as ActionType,
      title: '修正する (Ver.UP)',
      badge: `Ver.${currentCriteria.versionNumber + 1} へ改訂`,
      desc: '目標値が高すぎた・行動が合わなかったため、実行内容や数値を現実的に見直します。',
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">次の評価期限</label>
              <input
                type="date"
                value={revDeadline}
                onChange={(e) => setRevDeadline(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* カレンダー連携（完全無料通知） */}
            <button
              type="button"
              onClick={() => setShowCalendarModal(true)}
              className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>この期日をスマホカレンダーに登録</span>
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
          frequency: 'daily',
          deadlineDate: revDeadline,
        }}
      />
    </div>
  );
}
