'use client';

import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Target, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';
import { useLiff } from '@/components/liff-provider';
import type { PlanWizardFormData } from '@/lib/validations/plan';

export function Step1Objective() {
  const { isReady, user } = useLiff();
  const { register, watch, setValue, formState: { errors } } = useFormContext<PlanWizardFormData>();
  const [objectives, setObjectives] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const objectiveMode = watch('objectiveMode');
  const selectedObjectiveId = watch('selectedObjectiveId');

  useEffect(() => {
    if (!isReady) return;

    async function fetchObjectives() {
      try {
        const currentUserId = await getCurrentUserId(user || undefined);
        if (!currentUserId) {
          setValue('objectiveMode', 'create');
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from('objectives')
          .select('id, title')
          .eq('user_id', currentUserId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          setObjectives(data);
          if (!selectedObjectiveId) {
            setValue('selectedObjectiveId', data[0].id);
          }
        } else {
          setValue('objectiveMode', 'create');
        }
      } catch (e) {
        setValue('objectiveMode', 'create');
      } finally {
        setLoading(false);
      }
    }
    fetchObjectives();
  }, [setValue, selectedObjectiveId]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600" />
          何を達成したいですか？
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          このPlanが貢献する「上位の目的（ゴール）」を設定します。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setValue('objectiveMode', 'select')}
          disabled={objectives.length === 0}
          className={`py-2 text-xs font-semibold rounded-lg transition ${
            objectiveMode === 'select'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 disabled:opacity-40'
          }`}
        >
          既存の目的から選ぶ
        </button>
        <button
          type="button"
          onClick={() => setValue('objectiveMode', 'create')}
          className={`py-2 text-xs font-semibold rounded-lg transition ${
            objectiveMode === 'create'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          新しい目的をつくる
        </button>
      </div>

      {objectiveMode === 'select' ? (
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">読み込み中...</div>
          ) : (
            objectives.map((obj) => {
              const isSelected = selectedObjectiveId === obj.id;
              return (
                <div
                  key={obj.id}
                  onClick={() => setValue('selectedObjectiveId', obj.id, { shouldValidate: true })}
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition active:scale-[0.99] ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-medium'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm">{obj.title}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              目的のタイトル
            </label>
            <input
              type="text"
              placeholder="例: 健康的な運動習慣をつくる、TOEIC 800点達成"
              {...register('newObjectiveTitle')}
              className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block mb-1.5">よくある目的の例（タップで入力）:</span>
            <div className="flex flex-wrap gap-1.5">
              {['健康的な体づくり', '副業収益の確立', '読書・学習習慣化', '新規営業開拓'].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setValue('newObjectiveTitle', hint, { shouldValidate: true })}
                  className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {errors.selectedObjectiveId && (
        <p className="text-xs text-red-500">{errors.selectedObjectiveId.message}</p>
      )}
    </div>
  );
}
