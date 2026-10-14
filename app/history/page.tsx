'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  History, 
  Target, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw, 
  Wrench, 
  Compass, 
  Flag, 
  Sparkles, 
  Calendar,
  Loader2,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface ActionRecord {
  action_type: 'continue' | 'revise' | 'alternative' | 'terminate';
  reason?: string;
  created_at: string;
}

interface CheckRecord {
  id: string;
  evaluation_date: string;
  is_achieved: boolean;
  target_summary: string;
  actual_summary: string;
  actions?: ActionRecord[];
}

interface PlanVersionRecord {
  id: string;
  version_number: number;
  action_plan: string;
  target_value: number;
  unit: string;
  operator: 'gte' | 'lte' | 'eq';
  frequency: string;
  deadline: string;
  start_date: string;
  created_at: string;
  checks?: CheckRecord[];
}

interface PlanRecord {
  id: string;
  title: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  plan_versions: PlanVersionRecord[];
}

interface ObjectiveGroup {
  id: string;
  title: string;
  status: string;
  plans: PlanRecord[];
}

export default function HistoryPage() {
  const [objectives, setObjectives] = useState<ObjectiveGroup[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistoryData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
          .from('objectives')
          .select(`
            id,
            title,
            status,
            plans (
              id,
              title,
              status,
              plan_versions (
                id,
                version_number,
                action_plan,
                target_value,
                unit,
                operator,
                frequency,
                deadline,
                start_date,
                created_at,
                checks (
                  id,
                  evaluation_date,
                  is_achieved,
                  target_summary,
                  actual_summary,
                  actions (
                    action_type,
                    reason,
                    created_at
                  )
                )
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('History fetch error:', error);
        }

        const formatted: ObjectiveGroup[] = (data || []).map((obj: any) => ({
          ...obj,
          plans: (obj.plans || []).map((plan: any) => ({
            ...plan,
            plan_versions: (plan.plan_versions || []).sort(
              (a: any, b: any) => a.version_number - b.version_number
            ),
          })),
        }));

        setObjectives(formatted);

        if (formatted.length > 0 && selectedObjectiveId === 'all') {
          setSelectedObjectiveId(formatted[0].id);
        }
      } catch (err) {
        console.error('Fetch History Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistoryData();
  }, [selectedObjectiveId]);

  const filteredObjectives = useMemo(() => {
    if (selectedObjectiveId === 'all') return objectives;
    return objectives.filter((obj) => obj.id === selectedObjectiveId);
  }, [objectives, selectedObjectiveId]);

  const totalRevisions = useMemo(() => {
    return objectives.reduce((acc, obj) => {
      return (
        acc +
        obj.plans.reduce((pAcc, p) => pAcc + Math.max(0, p.plan_versions.length - 1), 0)
      );
    }, 0);
  }, [objectives]);

  const ACTION_CONFIG = {
    continue: { label: '継続', icon: RotateCw, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    revise: { label: '修正 (Ver.UP)', icon: Wrench, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    alternative: { label: '別手段へ移行', icon: Compass, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    terminate: { label: '完了・終了', icon: Flag, color: 'text-gray-700 bg-gray-100 border-gray-200' },
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-20 animate-in fade-in duration-200">
      <div className="pt-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
          <History className="w-3.5 h-3.5 text-emerald-600" />
          <span>PDCA 改善タイムライン</span>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 mt-0.5">Planの改訂・成長履歴</h1>
        <p className="text-xs text-gray-500 mt-1">
          目標達成に向け、Planをどう調整・最適化してきたかの軌跡です。
        </p>
      </div>

      {!loading && objectives.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                ITERATION COUNTER
              </span>
              <p className="text-xs font-bold text-gray-800">
                これまで <span className="text-sm font-black text-emerald-600">{totalRevisions}回</span> のPlan改訂を実施
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-white/80 px-2.5 py-1 rounded-full border border-emerald-200">
            着実に前進中
          </span>
        </div>
      )}

      {!loading && objectives.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
          <button
            type="button"
            onClick={() => setSelectedObjectiveId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
              selectedObjectiveId === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            すべて表示
          </button>
          {objectives.map((obj) => (
            <button
              key={obj.id}
              type="button"
              onClick={() => setSelectedObjectiveId(obj.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                selectedObjectiveId === obj.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>{obj.title}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-2 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs">改善履歴を読み込み中...</p>
        </div>
      ) : objectives.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">改善履歴はまだありません</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Planを立てて日々のDoを記録し、Check（評価）とActionを行うと、ここに成長のタイムラインが刻まれます。
            </p>
          </div>
          <Link
            href="/plans/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-98 transition"
          >
            最初のPlanを作成する
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredObjectives.map((obj) => (
            <div key={obj.id} className="space-y-3">
              <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                <h2 className="text-sm font-black text-gray-900">{obj.title}</h2>
              </div>

              {obj.plans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-gray-900">
                      取り組み: {plan.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      計 {plan.plan_versions.length} バージョン
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-emerald-200">
                    {plan.plan_versions.map((ver, idx) => {
                      const isLatest = idx === plan.plan_versions.length - 1;
                      const check = ver.checks?.[0];
                      const action = check?.actions?.[0];
                      const prevVer = idx > 0 ? plan.plan_versions[idx - 1] : null;

                      const isTargetChanged = prevVer && prevVer.target_value !== ver.target_value;

                      return (
                        <div key={ver.id} className="relative group">
                          <div
                            className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                              isLatest
                                ? 'bg-emerald-600 border-white text-white shadow-sm ring-2 ring-emerald-400'
                                : 'bg-white border-emerald-500 text-emerald-700'
                            }`}
                          >
                            {ver.version_number}
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl border transition-all ${
                              isLatest
                                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200/70'
                                : 'bg-gray-50/70 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                Ver. {ver.version_number}
                                {isLatest ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                    現在進行中
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-gray-400">
                                    改訂完了
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {ver.start_date || '開始'} 〜 {ver.deadline || '未定'}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-gray-800 leading-snug">
                              {ver.action_plan}
                            </p>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-gray-500">判定基準:</span>
                              <span className="font-bold text-gray-800">
                                毎日 {ver.target_value} {ver.unit}
                                {ver.operator === 'gte' ? ' 以上' : ver.operator === 'lte' ? ' 以下' : ' 一致'}
                              </span>

                              {isTargetChanged && prevVer && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                                  <span>{prevVer.target_value}{prevVer.unit}</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                  <span>{ver.target_value}{ver.unit} に調整</span>
                                </span>
                              )}
                            </div>

                            {check && (
                              <div className="mt-2.5 pt-2 border-t border-gray-200/70 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[11px] text-gray-500 font-medium">Check判定:</span>
                                  {check.is_achieved ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3" />
                                      目標達成 🎉
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                                      <AlertTriangle className="w-3 h-3" />
                                      未達成 ⚠️
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-600 bg-white/70 p-1.5 rounded-lg border border-gray-100">
                                  {check.actual_summary}
                                </p>

                                {action && (
                                  <div className="flex items-start gap-1.5 text-[11px] text-gray-600 pt-0.5">
                                    <span className="font-bold shrink-0 text-emerald-800">Action:</span>
                                    <span>
                                      <strong className="text-gray-800">
                                        {ACTION_CONFIG[action.action_type]?.label || action.action_type}
                                      </strong>
                                      {action.reason && `（${action.reason}）`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
