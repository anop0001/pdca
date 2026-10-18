'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  Plus,
  Minus,
  Target,
  Flame,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Loader2,
  Pencil,
  Trash2,
  Calendar,
} from 'lucide-react';
import { CalendarReminderModal } from '@/components/calendar-reminder-modal';

export interface PlanWithDetails {
  id: string;
  objective_id?: string;
  title: string;
  objectiveTitle: string;
  currentVersion: {
    id: string;
    version_number?: number;
    action_plan: string;
    target_value: number;
    unit: string;
    operator: 'gte' | 'lte' | 'eq';
    frequency: string;
    deadline: string;
  };
  todayRecord?: {
    id: string;
    record_date?: string;
    actual_value: number;
    is_completed: boolean;
  } | null;
}

interface DoRecordCardProps {
  plan: PlanWithDetails;
  hideObjectiveHeader?: boolean;
  planIndex?: number;
  onSaveRecord: (
    planId: string,
    versionId: string,
    actualValue: number,
    isCompleted: boolean
  ) => Promise<void>;
  onResetRecord?: (planId: string) => Promise<void>;
  onEdit?: (plan: PlanWithDetails) => void;
  onDelete?: (planId: string) => void;
}

export function DoRecordCard({
  plan,
  hideObjectiveHeader = false,
  planIndex,
  onSaveRecord,
  onResetRecord,
  onEdit,
  onDelete,
}: DoRecordCardProps) {
  const version = plan.currentVersion;
  const isBinaryType = version.unit === '回' && Number(version.target_value) === 1;

  const [actualValue, setActualValue] = useState<number>(plan.todayRecord?.actual_value ?? 0);
  const [isCompleted, setIsCompleted] = useState<boolean>(plan.todayRecord?.is_completed ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  useEffect(() => {
    setActualValue(plan.todayRecord?.actual_value ?? 0);
    setIsCompleted(plan.todayRecord?.is_completed ?? false);
    setHasChanged(false);
  }, [plan.todayRecord]);

  const checkIfAchieved = (val: number): boolean => {
    const target = Number(version.target_value) || 0;
    if (isBinaryType) return val >= 1;
    switch (version.operator) {
      case 'gte':
        return val >= target;
      case 'lte':
        return val <= target && val > 0;
      case 'eq':
        return val === target;
      default:
        return false;
    }
  };

  // 本日の記録ステータス（達成 / 未達成 / 未入力）
  const currentStatus: 'achieved' | 'unachieved' | 'unrecorded' =
    !plan.todayRecord
      ? 'unrecorded'
      : plan.todayRecord.is_completed
      ? 'achieved'
      : 'unachieved';

  // 回数型(1回)の達成/未達成ワンタップ登録
  const handleBinaryAction = async (completed: boolean) => {
    const nextVal = completed ? 1 : 0;
    setIsCompleted(completed);
    setActualValue(nextVal);
    setIsSaving(true);
    await onSaveRecord(plan.id, version.id, nextVal, completed);
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

  const targetVal = Number(version.target_value) || 1;
  const progressPercent = Math.min(
    100,
    Math.round((actualValue / targetVal) * 100)
  );

  const cardBgClass =
    currentStatus === 'achieved'
      ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-200 shadow-sm'
      : currentStatus === 'unachieved'
      ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200 shadow-sm'
      : 'bg-white border-gray-200/80 hover:border-gray-300 shadow-sm';

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-300 ${cardBgClass}`}>
      {/* 1行目: 目標タグ (または取り組み番号) ＆ 達成ステータスバッジ */}
      <div className="flex items-center justify-between mb-2 gap-2">
        {hideObjectiveHeader ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200/60">
            取り組み {typeof planIndex === 'number' ? planIndex + 1 : ''}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 max-w-[70%] truncate"
            title={plan.objectiveTitle}
          >
            <Target className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate">{plan.objectiveTitle}</span>
          </span>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {currentStatus === 'achieved' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              達成
            </span>
          )}
          {currentStatus === 'unachieved' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              未達成
            </span>
          )}
          {currentStatus === 'unrecorded' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
              <HelpCircle className="w-3 h-3 text-slate-400" />
              未入力
            </span>
          )}
        </div>
      </div>

      {/* 2行目: アクションプランタイトル ＆ バージョンバッジ */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 ${
            version.version_number && version.version_number > 1
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          Ver.{version.version_number || 1}
        </span>
        <h3 className="text-base font-bold text-gray-900 leading-snug">
          {version.action_plan || plan.title}
        </h3>
      </div>

      {/* 3行目: 目標数値 ＆ 操作アイコン群（Check, カレンダー, 編集, 削除をこのラインに配置） */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
          <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="truncate">
            目標: 毎日 {version.target_value} {version.unit}
            {version.operator === 'gte' ? ' 以上' : version.operator === 'lte' ? ' 以下' : ' 一致'}
          </span>
        </p>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowCalendarModal(true)}
            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
            title="評価期日をカレンダーに登録"
            aria-label="カレンダー"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(plan)}
              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
              title="Planを編集"
              aria-label="編集"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(plan.id)}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Planを削除"
              aria-label="削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isBinaryType ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleBinaryAction(true)}
              disabled={isSaving}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                currentStatus === 'achieved'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400 ring-offset-1'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {currentStatus === 'achieved' ? '達成 (登録済)' : '達成'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleBinaryAction(false)}
              disabled={isSaving}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                currentStatus === 'unachieved'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400 ring-offset-1'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  {currentStatus === 'unachieved' ? '未達成 (登録済)' : '未達成'}
                </>
              )}
            </button>
          </div>

          {currentStatus !== 'unrecorded' && onResetRecord && (
            <div className="text-right pt-0.5">
              <button
                type="button"
                onClick={() => onResetRecord(plan.id)}
                disabled={isSaving}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline transition inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                本日の記録を取消して未入力に戻す
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full transition-all duration-300 bg-emerald-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepValue(-1)}
              disabled={actualValue <= 0 || isSaving}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 disabled:opacity-30 transition shrink-0"
              aria-label="減らす"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                value={actualValue === 0 && !hasChanged && currentStatus === 'unrecorded' ? '' : actualValue}
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
              aria-label="増やす"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* 登録ボタン: 「未達」「達成」を入れず「登録」のみ表示 */}
            <button
              type="button"
              onClick={handleSaveNumeric}
              disabled={isSaving || (!hasChanged && currentStatus !== 'unrecorded')}
              className={`h-11 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-[0.98] shrink-0 ${
                isSaving
                  ? 'bg-gray-200 text-gray-500'
                  : hasChanged || currentStatus === 'unrecorded'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 border border-transparent'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasChanged || currentStatus === 'unrecorded' ? (
                '登録'
              ) : (
                '登録済'
              )}
            </button>
          </div>

          {/* 判定区分切り替えと未入力リセット */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 font-medium">判定区分:</span>
              <button
                type="button"
                onClick={() => {
                  setIsCompleted(true);
                  setHasChanged(true);
                }}
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition flex items-center gap-1 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                達成
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCompleted(false);
                  setHasChanged(true);
                }}
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition flex items-center gap-1 ${
                  !isCompleted
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                未達成
              </button>
            </div>

            {currentStatus !== 'unrecorded' && onResetRecord && (
              <button
                type="button"
                onClick={() => onResetRecord(plan.id)}
                disabled={isSaving}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline transition inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                未入力に戻す
              </button>
            )}
          </div>
        </div>
      )}

      {/* カレンダーリマインドモーダル */}
      <CalendarReminderModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        options={{
          title: version.action_plan || plan.title,
          targetValue: version.target_value,
          unit: version.unit,
          frequency: version.frequency,
          deadlineDate: version.deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        }}
      />
    </div>
  );
}
