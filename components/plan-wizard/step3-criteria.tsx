'use client';

import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Gauge, Calendar, Flag } from 'lucide-react';
import type { PlanWizardFormData } from '@/lib/validations/plan';
import { CalendarReminderModal } from '@/components/calendar-reminder-modal';

export function Step3Criteria() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<PlanWizardFormData>();
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const actionPlan = watch('actionPlan');
  const targetValue = watch('targetValue');
  const unit = watch('unit');
  const operator = watch('operator');
  const frequency = watch('frequency');
  const deadline = watch('deadline');

  const QUICK_UNITS = ['回', '分', '時間', '件', '歩', 'ページ'];

  const OPERATOR_LABELS: Record<string, string> = {
    gte: '以上 (達成)',
    lte: '以下 (抑制)',
    eq: 'ちょうど (一致)',
  };

  const FREQUENCY_LABELS: Record<string, string> = {
    daily: '毎日',
    weekday: '平日のみ',
    weekly: '毎週',
    single: '期日までに1度',
  };

  const setQuickDeadline = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setValue('deadline', d.toISOString().split('T')[0], { shouldValidate: true });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-emerald-600" />
          達成できたか、どう判断しますか？
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          曖昧さをなくすため、客観的にYes/Noが判定できる基準を決めます。
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-700">目標数値 & 単位</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            step="any"
            placeholder="例: 30"
            {...register('targetValue', { valueAsNumber: true })}
            className="w-full p-3 border border-gray-300 rounded-xl text-base font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <input
            type="text"
            placeholder="単位 (例: 分)"
            {...register('unit')}
            className="w-full p-3 border border-gray-300 rounded-xl text-sm text-center focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setValue('unit', u, { shouldValidate: true })}
              className={`px-2.5 py-1 text-xs rounded-lg transition ${
                unit === u ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        {errors.targetValue && <p className="text-xs text-red-500">{errors.targetValue.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-700">判定条件（方向）</label>
        <div className="grid grid-cols-3 gap-2">
          {(['gte', 'lte', 'eq'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setValue('operator', op)}
              className={`py-2.5 px-2 text-xs font-medium rounded-xl border transition ${
                operator === op
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {OPERATOR_LABELS[op]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-700">実行頻度</label>
        <div className="grid grid-cols-2 gap-2">
          {(['daily', 'weekday', 'weekly', 'single'] as const).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => setValue('frequency', freq)}
              className={`py-2 px-3 text-xs rounded-xl border transition ${
                frequency === freq
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {FREQUENCY_LABELS[freq]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          評価期限（振り返り日）
        </label>
        <input
          type="date"
          {...register('deadline')}
          className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
        />
        <div className="flex gap-2">
          {[
            { label: '+1週間後', days: 7 },
            { label: '+2週間後', days: 14 },
            { label: '+1ヶ月後', days: 30 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setQuickDeadline(item.days)}
              className="flex-1 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* カレンダー連携（完全無料通知） */}
        <button
          type="button"
          onClick={() => setShowCalendarModal(true)}
          className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition shadow-xs mt-2"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>評価期日をスマホカレンダーに登録</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">無料通知</span>
        </button>
      </div>

      <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
        <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
          <Flag className="w-3.5 h-3.5 text-emerald-600" />
          判定基準プレビュー
        </div>
        <p className="text-xs text-emerald-950 font-medium leading-relaxed">
          「<span className="font-bold underline">{deadline || '期日'}</span> までに、
          <span className="font-bold">{FREQUENCY_LABELS[frequency]}</span>
          <span className="font-bold text-emerald-700 text-sm mx-1">{targetValue || 0}{unit || '回'}</span>
          <span className="font-bold">{OPERATOR_LABELS[operator]?.split(' ')[0]}</span>
          を達成基準とする」
        </p>
      </div>

      {/* カレンダーリマインドモーダル */}
      <CalendarReminderModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        options={{
          title: actionPlan || 'PDCA目標アクション',
          targetValue: targetValue || 1,
          unit: unit || '回',
          frequency: frequency || 'daily',
          deadlineDate: deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        }}
      />
    </div>
  );
}
