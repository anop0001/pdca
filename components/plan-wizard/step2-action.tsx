'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Sparkles } from 'lucide-react';
import type { PlanWizardFormData } from '@/lib/validations/plan';

export function Step2Action() {
  const { register, formState: { errors } } = useFormContext<PlanWizardFormData>();

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          そのために、何をしますか？
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          目的を達成するために「実行するアクション（Plan）」を1つ定めます。
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-700">
          実行内容 (行動プラン)
        </label>
        <textarea
          rows={3}
          placeholder="例: 毎朝出社前にカフェで英語学習をする、新規開拓の電話をかける"
          {...register('actionPlan')}
          className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
        />
        {errors.actionPlan && (
          <p className="text-xs text-red-500">{errors.actionPlan.message}</p>
        )}
      </div>

      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
        <p className="font-semibold">💡 Plan改善のコツ</p>
        <p className="text-[11px] leading-relaxed text-amber-700">
          「頑張る」といった意気込みではなく、「いつ・どこで・何をするか」を明確にすると行動が続きやすく、後のCheck（振り返り）が的確になります。
        </p>
      </div>
    </div>
  );
}
