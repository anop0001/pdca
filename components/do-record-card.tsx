'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, Plus, Minus, Target, Flame, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export interface PlanWithDetails {
  id: string;
  title: string;
  objectiveTitle: string;
  currentVersion: {
    id: string;
    action_plan: string;
    target_value: number;
    unit: string;
    operator: 'gte' | 'lte' | 'eq';
    frequency: string;
    deadline: string;
  };
  todayRecord?: {
    id: string;
    actual_value: number;
    is_completed: boolean;
  } | null;
}

interface DoRecordCardProps {
  plan: PlanWithDetails;
  onSaveRecord: (
    planId: string,
    versionId: string,
    actualValue: number,
    isCompleted: boolean
  ) => Promise<void>;
}

export function DoRecordCard({ plan, onSaveRecord }: DoRecordCardProps) {
  const version = plan.currentVersion;
  const isBinaryType = version.unit === '回' && version.target_value === 1;

  const [actualValue, setActualValue] = useState<number>(plan.todayRecord?.actual_value ?? 0);
  const [isCompleted, setIsCompleted] = useState<boolean>(plan.todayRecord?.is_completed ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    setActualValue(plan.todayRecord?.actual_value ?? 0);
    setIsCompleted(plan.todayRecord?.is_completed ?? false);
    setHasChanged(false);
  }, [plan.todayRecord]);

  const checkIfAchieved = (val: number): boolean => {
    if (isBinaryType) return isCompleted;
    switch (version.operator) {
      case 'gte': return val >= version.target_value;
      case 'lte': return val <= version.target_value && val > 0;
      case 'eq': return val === version.target_value;
      default: return false;
    }
  };

  const handleToggleBinary = async () => {
    const nextCompleted = !isCompleted;
    const nextVal = nextCompleted ? 1 : 0;
    setIsCompleted(nextCompleted);
    setActualValue(nextVal);
    setIsSaving(true);
    await onSaveRecord(plan.id, version.id, nextVal, nextCompleted);
    setIsSaving(false);
  };

  const handleStepValue = (delta: number) => {
    const nextVal = Math.max(0, Number((actualValue + delta).toFixed(1)));
    setActualValue(nextVal);
    const achieved = checkIfAchieved(nextVal);
    setIsCompleted(achieved);
    setHasChanged(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setActualValue(val);
    const achieved = checkIfAchieved(val);
    setIsCompleted(achieved);
    setHasChanged(true);
  };

  const handleSaveNumeric = async () => {
    setIsSaving(true);
    await onSaveRecord(plan.id, version.id, actualValue, isCompleted);
    setIsSaving(false);
    setHasChanged(false);
  };

  const progressPercent = Math.min(
    100,
    Math.round((actualValue / (version.target_value || 1)) * 100)
  );

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-300 shadow-sm ${
        isCompleted
          ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200'
          : 'bg-white border-gray-200/80 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
          <Target className="w-3 h-3 text-emerald-600" />
          {plan.objectiveTitle}
        </span>
        <div className="flex items-center gap-1.5">
          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              達成
            </span>
          )}
          <Link
            href={`/plans/${plan.id}/check`}
            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-0.5"
          >
            Check ➔
          </Link>
        </div>
      </div>

      <h3 className="text-base font-bold text-gray-900 leading-snug mb-1">
        {version.action_plan || plan.title}
      </h3>
      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <Flame className="w-3 h-3 text-orange-500" />
        目標: 毎日 {version.target_value} {version.unit}
        {version.operator === 'gte' ? ' 以上' : version.operator === 'lte' ? ' 以下' : ' 一致'}
      </p>

      {isBinaryType ? (
        <button
          type="button"
          onClick={handleToggleBinary}
          disabled={isSaving}
          className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${
            isCompleted
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isCompleted ? (
            <>
              <Check className="w-5 h-5 stroke-[3]" />
              本日の実行を完了しました！
            </>
          ) : (
            <>
              <span className="w-5 h-5 rounded-md border-2 border-gray-400 inline-block" />
              タップして本日の完了を記録
            </>
          )}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isCompleted ? 'bg-emerald-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepValue(-1)}
              disabled={actualValue <= 0 || isSaving}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 disabled:opacity-30 transition shrink-0"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                value={actualValue === 0 && !hasChanged ? '' : actualValue}
                placeholder="0"
                onChange={handleInputChange}
                className="w-full h-11 px-3 pr-10 text-center font-bold text-lg rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 pointer-events-none">
                {version.unit}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleStepValue(1)}
              disabled={isSaving}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 transition shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleSaveNumeric}
              disabled={isSaving || !hasChanged}
              className={`h-11 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-[0.98] ${
                hasChanged
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 border border-transparent'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '保存'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
