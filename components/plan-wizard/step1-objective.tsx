'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Target, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';
import { useLiff } from '@/components/liff-provider';
import type { PlanWizardFormData } from '@/lib/validations/plan';

export function Step1Objective() {
  const { isReady, user } = useLiff();
  const { register, watch, setValue, formState: { errors } } = useFormContext<PlanWizardFormData>();
  const [objectives, setObjectives] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const objectiveMode = watch('objectiveMode') || 'create';
  const selectedObjectiveId = watch('selectedObjectiveId');

  const what = watch('objectiveWhat') || '';
  const when = watch('objectiveWhen') || '';
  const state = watch('objectiveState') || '';

  const synthesizedTitle = useMemo(() => {
    if (!what && !when && !state) return '';
    const cleanWhen = when ? (when.endsWith('まで') || when.endsWith('までに') ? when : `${when}までに`) : '';
    const parts = [
      what ? `【何を】${what}` : '',
      cleanWhen ? `【いつまでに】${cleanWhen}` : '',
      state ? `【どういった状態】${state}` : '',
    ].filter(Boolean);
    return parts.join(' ');
  }, [what, when, state]);

  // 3項目からタイトルを自動生成してフォームへ同期
  useEffect(() => {
    if (objectiveMode === 'create' && synthesizedTitle) {
      setValue('newObjectiveTitle', synthesizedTitle);
    }
  }, [objectiveMode, synthesizedTitle, setValue]);

  useEffect(() => {
    if (!isReady) return;

    async function fetchObjectives() {
      try {
        const currentUserId = await getCurrentUserId(user || undefined);
        let list: { id: string; title: string }[] = [];

        if (currentUserId) {
          const { data } = await supabase
            .from('objectives')
            .select('id, title')
            .eq('user_id', currentUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

          if (data && data.length > 0) {
            list = [...data];
          }
        }

        // ローカルストレージ内のPlanからも目的を抽出してマージ（オフライン/Supabase同期前の目的も確実に選択肢に出す）
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('pdca_local_plans');
            if (raw) {
              const localPlans = JSON.parse(raw);
              for (const lp of localPlans) {
                if (lp.objectiveTitle && lp.objectiveTitle !== '目的未設定') {
                  const exists = list.some(
                    (o) => o.title === lp.objectiveTitle || (lp.objective_id && o.id === lp.objective_id)
                  );
                  if (!exists) {
                    list.push({
                      id: lp.objective_id || `local-obj-${encodeURIComponent(lp.objectiveTitle)}`,
                      title: lp.objectiveTitle,
                    });
                  }
                }
              }
            }
          } catch {}
        }

        setObjectives(list);

        // URLパラメータからの事前選択判定 (?objective_id=xxx または ?objective_title=yyy)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const paramObjId = params.get('objective_id');
          const paramObjTitle = params.get('objective_title');

          if (paramObjId || paramObjTitle) {
            const matched = list.find(
              (o) => (paramObjId && o.id === paramObjId) || (paramObjTitle && o.title === paramObjTitle)
            );

            if (matched) {
              setValue('objectiveMode', 'select');
              setValue('selectedObjectiveId', matched.id);
            } else if (paramObjTitle) {
              const newObjEntry = {
                id: paramObjId || `local-obj-${encodeURIComponent(paramObjTitle)}`,
                title: paramObjTitle,
              };
              list.unshift(newObjEntry);
              setObjectives([...list]);
              setValue('objectiveMode', 'select');
              setValue('selectedObjectiveId', newObjEntry.id);
            }
          } else if (list.length > 0 && !selectedObjectiveId) {
            setValue('selectedObjectiveId', list[0].id);
          }
        } else if (list.length > 0 && !selectedObjectiveId) {
          setValue('selectedObjectiveId', list[0].id);
        }
      } catch (e) {
        // エラー時も基本入力モードを維持
      } finally {
        setLoading(false);
      }
    }
    fetchObjectives();
  }, [isReady, user, setValue, selectedObjectiveId]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600" />
          何を達成したいですか？
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          曖昧さをなくすため、「何を・いつまでに・どういった状態」の3点を具体化します。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setValue('objectiveMode', 'create')}
          className={`py-2 text-xs font-semibold rounded-lg transition ${
            objectiveMode === 'create'
              ? 'bg-white text-emerald-700 shadow-sm font-bold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          新しい目的を入力する
        </button>
        <button
          type="button"
          onClick={() => setValue('objectiveMode', 'select')}
          disabled={objectives.length === 0}
          className={`py-2 text-xs font-semibold rounded-lg transition ${
            objectiveMode === 'select'
              ? 'bg-white text-emerald-700 shadow-sm font-bold'
              : 'text-gray-500 hover:text-gray-700 disabled:opacity-40'
          }`}
        >
          既存の目的に追加する {objectives.length > 0 ? `(${objectives.length})` : ''}
        </button>
      </div>

      {objectiveMode === 'create' ? (
        <div className="space-y-4">
          {/* ① 何を： */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">1</span>
                <span className="text-sm font-black text-gray-900">何を：</span>
                <span className="text-[11px] font-normal text-gray-500">（対象・テーマ）</span>
              </span>
              <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded">必須</span>
            </label>
            <input
              type="text"
              placeholder="例: 体重、TOEICスコア、月間売上、早起き習慣"
              {...register('objectiveWhat')}
              className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {['体重', '英語力・TOEIC', '月間売上', '読書・学習習慣', '体脂肪率'].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setValue('objectiveWhat', hint, { shouldValidate: true })}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition active:scale-95"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>

          {/* ② いつまでに： */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">2</span>
                <span className="text-sm font-black text-gray-900">いつまでに：</span>
                <span className="text-[11px] font-normal text-gray-500">（達成期日）</span>
              </span>
              <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded">必須</span>
            </label>
            <input
              type="text"
              placeholder="例: 3ヶ月後、2026年12月末、次の試験日までに"
              {...register('objectiveWhen')}
              className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {['1ヶ月後', '3ヶ月後', '半年後', '年末までに'].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setValue('objectiveWhen', hint, { shouldValidate: true })}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition active:scale-95"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>

          {/* ③ どういった状態： */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">3</span>
                <span className="text-sm font-black text-gray-900">どういった状態：</span>
                <span className="text-[11px] font-normal text-gray-500">（目標状態・ゴール）</span>
              </span>
              <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded">必須</span>
            </label>
            <input
              type="text"
              placeholder="例: 65kg以下をキープしている、800点を突破している"
              {...register('objectiveState')}
              className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {['65kg以下をキープ', '800点突破', '売上目標を達成', '毎日継続できている'].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setValue('objectiveState', hint, { shouldValidate: true })}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition active:scale-95"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>

          {/* プレビュー表示 */}
          {synthesizedTitle && (
            <div className="p-3.5 bg-emerald-50/90 border border-emerald-200/90 rounded-xl space-y-1.5 animate-in fade-in duration-150 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                具体化された目的のプレビュー:
              </span>
              <p className="text-xs font-black text-emerald-950 leading-relaxed bg-white/80 p-2 rounded-lg border border-emerald-100">
                {synthesizedTitle}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">読み込み中...</div>
          ) : objectives.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 space-y-2">
              <p className="text-xs text-gray-500">既存の大目的がまだ登録されていません。</p>
              <button
                type="button"
                onClick={() => setValue('objectiveMode', 'create')}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                ＋ 新しい目的を入力する
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">
                追加先の大目的を選択してください：
              </p>
              {objectives.map((obj) => {
                const isSelected = selectedObjectiveId === obj.id;
                return (
                  <div
                    key={obj.id}
                    onClick={() => setValue('selectedObjectiveId', obj.id, { shouldValidate: true })}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between gap-3 transition active:scale-[0.99] ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium ring-1 ring-emerald-300 shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-sm font-bold block break-words">{obj.title}</span>
                      {isSelected && (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          この大目的に新しいPlan（取り組み）を追加します
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {errors.objectiveWhat && (
        <p className="text-xs text-red-500 font-bold bg-red-50 border border-red-200 p-2.5 rounded-lg">
          {errors.objectiveWhat.message}
        </p>
      )}
      {errors.selectedObjectiveId && (
        <p className="text-xs text-red-500 font-bold bg-red-50 border border-red-200 p-2.5 rounded-lg">
          {errors.selectedObjectiveId.message}
        </p>
      )}
    </div>
  );
}
