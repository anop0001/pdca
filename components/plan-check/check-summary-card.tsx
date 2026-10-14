'use client';

import React from 'react';
import { Target, Trophy, AlertTriangle, Calendar, Activity } from 'lucide-react';

interface CheckSummaryCardProps {
  planTitle: string;
  objectiveTitle: string;
  targetCriteria: {
    targetValue: number;
    unit: string;
    operator: 'gte' | 'lte' | 'eq';
    frequency: string;
    deadline: string;
    startDate: string;
  };
  actualStats: {
    totalValue: number;
    averageValue: number;
    recordedDays: number;
    totalDays: number;
    achievedDaysCount: number;
  };
  isAchieved: boolean;
}

export function CheckSummaryCard({
  planTitle,
  objectiveTitle,
  targetCriteria,
  actualStats,
  isAchieved,
}: CheckSummaryCardProps) {
  const operatorLabel =
    targetCriteria.operator === 'gte' ? '以上' : targetCriteria.operator === 'lte' ? '以下' : '一致';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
        <Target className="w-3.5 h-3.5 text-emerald-600" />
        <span>{objectiveTitle}</span>
      </div>

      <h1 className="text-xl font-extrabold text-gray-900 leading-snug">
        {planTitle}
      </h1>

      <div
        className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${
          isAchieved
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isAchieved ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {isAchieved ? (
              <Trophy className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
              SYSTEM CHECK RESULT
            </span>
            <p className="text-lg font-black leading-tight">
              {isAchieved ? '目標達成！おめでとうございます 🎉' : '未達成（改善のチャンスです） ⚠️'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl">
          <span className="text-[11px] font-bold text-gray-400 block mb-1">
            設定した目標 (Plan)
          </span>
          <p className="text-sm font-extrabold text-gray-800">
            {targetCriteria.targetValue} {targetCriteria.unit} {operatorLabel}
          </p>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            期日: {targetCriteria.deadline}
          </p>
        </div>

        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl">
          <span className="text-[11px] font-bold text-gray-400 block mb-1">
            期間の実績 (Do)
          </span>
          <p className="text-sm font-extrabold text-gray-800">
            合計: {actualStats.totalValue} {targetCriteria.unit}
          </p>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-gray-400" />
            記録率: {actualStats.recordedDays}/{actualStats.totalDays}日
          </p>
        </div>
      </div>
    </div>
  );
}
