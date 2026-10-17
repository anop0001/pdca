'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Target,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  ClipboardX,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';
import { CheckSummaryCard } from '@/components/plan-check/check-summary-card';
import { ActionSelector, type ActionType } from '@/components/plan-check/action-selector';

export type ObjectiveOutcome = 'achieved' | 'unachieved' | 'suspended' | 'unrecorded';

const OUTCOME_OPTIONS = [
  {
    value: 'achieved' as ObjectiveOutcome,
    label: '達成',
    badge: '目標クリア',
    desc: '設定した大目的・状態を達成できた',
    icon: CheckCircle2,
    activeClass: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 text-emerald-900',
    inactiveClass: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  },
  {
    value: 'unachieved' as ObjectiveOutcome,
    label: '未達成',
    badge: '成果未達',
    desc: '期間内に大目的の状態には届かなかった',
    icon: AlertTriangle,
    activeClass: 'border-amber-500 bg-amber-50 ring-2 ring-amber-400 text-amber-900',
    inactiveClass: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  },
  {
    value: 'suspended' as ObjectiveOutcome,
    label: '中断',
    badge: '取り組み中断',
    desc: '体調や環境の変化等により途中で中断した',
    icon: PauseCircle,
    activeClass: 'border-blue-500 bg-blue-50 ring-2 ring-blue-400 text-blue-900',
    inactiveClass: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  },
  {
    value: 'unrecorded' as ObjectiveOutcome,
    label: '記録なし',
    badge: '判定データ不足',
    desc: '成果判定に必要な測定・記録がなかった',
    icon: ClipboardX,
    activeClass: 'border-slate-500 bg-slate-100 ring-2 ring-slate-400 text-slate-800',
    inactiveClass: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  },
];

interface PlanDetailData {
  id: string;
  title: string;
  objective_id: string;
  objectives: { id: string; title: string };
  plan_versions: Array<{
    id: string;
    version_number: number;
    action_plan: string;
    target_value: number;
    unit: string;
    operator: 'gte' | 'lte' | 'eq';
    frequency: string;
    deadline: string;
    start_date: string;
  }>;
  do_records: Array<{
    record_date: string;
    actual_value: number;
    is_completed: boolean;
  }>;
}

export default function PlanCheckPage() {
  const router = useRouter();
  const routeParams = useParams();
  const planId = (routeParams?.id as string) || '';

  const [planData, setPlanData] = useState<PlanDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 大目的の4段階確認ステート（達成、未達成、中断、記録なし）
  const [objectiveOutcome, setObjectiveOutcome] = useState<ObjectiveOutcome>('unachieved');
  const [outcomeMemo, setOutcomeMemo] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      if (!planId) return;
      try {
        const { data, error } = await supabase
          .from('plans')
          .select(`
            id,
            title,
            objective_id,
            objectives ( id, title ),
            plan_versions (
              id,
              version_number,
              action_plan,
              target_value,
              unit,
              operator,
              frequency,
              deadline,
              start_date
            ),
            do_records (
              record_date,
              actual_value,
              is_completed
            )
          `)
          .eq('id', planId)
          .maybeSingle();

        if (error) {
          console.warn('Fetch Check Data Supabase warning:', error);
        }

        // ローカルストレージ（pdca_local_records & pdca_local_plans）の実績レコードを取得
        let localPlanRecords: any[] = [];
        if (typeof window !== 'undefined') {
          try {
            const recRaw = localStorage.getItem('pdca_local_records');
            if (recRaw) {
              const recList = JSON.parse(recRaw);
              localPlanRecords = recList.filter((r: any) => r.plan_id === planId);
            }
          } catch {}

          try {
            const plansRaw = localStorage.getItem('pdca_local_plans');
            if (plansRaw) {
              const pList = JSON.parse(plansRaw);
              const matched = pList.find((p: any) => p.id === planId);
              if (matched?.todayRecord) {
                const todayStr = new Date().toISOString().split('T')[0];
                if (!localPlanRecords.some((r) => r.record_date === todayStr)) {
                  localPlanRecords.push({
                    record_date: todayStr,
                    actual_value: matched.todayRecord.actual_value,
                    is_completed: matched.todayRecord.is_completed,
                  });
                }
              }
            }
          } catch {}
        }

        if (data) {
          const combinedRecords = [...(data.do_records || [])];
          const existingDates = new Set(combinedRecords.map((r: any) => r.record_date));
          for (const lr of localPlanRecords) {
            if (!existingDates.has(lr.record_date)) {
              combinedRecords.push(lr);
              existingDates.add(lr.record_date);
            } else {
              const idx = combinedRecords.findIndex((r: any) => r.record_date === lr.record_date);
              if (idx >= 0 && lr.actual_value !== undefined) {
                combinedRecords[idx] = { ...combinedRecords[idx], ...lr };
              }
            }
          }
          setPlanData({ ...data, do_records: combinedRecords } as any);
        } else {
          setPlanData({
            id: planId,
            title: '実行Plan',
            objective_id: '',
            objectives: { id: '', title: '目標設定' },
            plan_versions: [
              {
                id: 'v1',
                version_number: 1,
                action_plan: '毎日のPDCAアクション',
                target_value: 1,
                unit: '回',
                operator: 'gte',
                frequency: 'daily',
                deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                start_date: new Date().toISOString().split('T')[0],
              },
            ],
            do_records: localPlanRecords,
          });
        }
      } catch (err: any) {
        console.error('Fetch Check Data Error:', err);
        setErrorMessage(err.message || 'データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [planId]);

  const currentVersion = (planData?.plan_versions || []).sort(
    (a, b) => b.version_number - a.version_number
  )[0] || {
    id: 'v1',
    version_number: 1,
    action_plan: planData?.title || 'Planアクション',
    target_value: 1,
    unit: '回',
    operator: 'gte' as const,
    frequency: 'daily',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
  };

  const records = planData?.do_records || [];
  const totalValue = records.reduce((acc, r) => acc + (r.actual_value || 0), 0);
  const recordedDays = records.length;
  const averageValue = recordedDays > 0 ? Number((totalValue / recordedDays).toFixed(1)) : 0;
  const achievedDaysCount = records.filter((r) => r.is_completed).length;

  const startDateStr = currentVersion.start_date || currentVersion.deadline || new Date().toISOString().split('T')[0];
  const deadlineStr = currentVersion.deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const start = new Date(startDateStr);
  const end = new Date(deadlineStr);
  const diffTime = end.getTime() - start.getTime();
  const totalPeriodDays = Math.max(1, !isNaN(diffTime) ? Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1 : 7);

  let isAchieved = false;
  if (currentVersion.unit === '回' && currentVersion.target_value === 1) {
    isAchieved = (achievedDaysCount / totalPeriodDays) >= 0.7;
  } else {
    switch (currentVersion.operator) {
      case 'gte': isAchieved = averageValue >= currentVersion.target_value; break;
      case 'lte': isAchieved = averageValue <= currentVersion.target_value && averageValue > 0; break;
      case 'eq': isAchieved = averageValue === currentVersion.target_value; break;
    }
  }

  const checkStatus: 'achieved' | 'unachieved' | 'unrecorded' =
    recordedDays === 0 ? 'unrecorded' : isAchieved ? 'achieved' : 'unachieved';

  // 行動実績のステータスに合わせて大目的のデフォルトを自動設定
  useEffect(() => {
    if (checkStatus === 'achieved') setObjectiveOutcome('achieved');
    else if (checkStatus === 'unrecorded') setObjectiveOutcome('unrecorded');
    else setObjectiveOutcome('unachieved');
  }, [checkStatus]);

  const handleConfirmAction = async (
    actionType: ActionType,
    revisionData?: {
      actionPlan: string;
      targetValue: number;
      unit: string;
      operator: 'gte' | 'lte' | 'eq';
      frequency: string;
      deadline: string;
    }
  ) => {
    if (!planData) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const authId = await getCurrentUserId();
      const userId = authId || '00000000-0000-0000-0000-000000000001';

      const outcomeLabel =
        objectiveOutcome === 'achieved' ? '達成' :
        objectiveOutcome === 'unachieved' ? '未達成' :
        objectiveOutcome === 'suspended' ? '中断' : '記録なし';

      const formattedActualSummary = recordedDays === 0
        ? `未記録 (記録 0/${totalPeriodDays}日・判定データなし)`
        : `行動実績平均: ${averageValue}${currentVersion.unit} (記録 ${recordedDays}/${totalPeriodDays}日)`;

      const fullActualSummary = `[大目的:${outcomeLabel}] ${outcomeMemo.trim() ? outcomeMemo.trim() + ' ｜ ' : ''}${formattedActualSummary}`;

      const { data: checkRecord } = await supabase
        .from('checks')
        .insert({
          plan_id: planData.id,
          plan_version_id: currentVersion.id,
          user_id: userId,
          evaluation_date: new Date().toISOString().split('T')[0],
          is_achieved: objectiveOutcome === 'achieved',
          target_summary: `大目的: ${planData.objectives?.title || planData.title}`,
          actual_summary: fullActualSummary,
        })
        .select('id')
        .maybeSingle();

      let nextPlanVersionId: string | null = null;

      if (actionType === 'revise' && revisionData) {
        const nextVerNum = currentVersion.version_number + 1;
        const { data: newVer } = await supabase
          .from('plan_versions')
          .insert({
            plan_id: planData.id,
            user_id: userId,
            version_number: nextVerNum,
            action_plan: revisionData.actionPlan,
            target_value: revisionData.targetValue,
            unit: revisionData.unit,
            operator: revisionData.operator,
            frequency: revisionData.frequency,
            deadline: revisionData.deadline,
          })
          .select('id')
          .single();

        nextPlanVersionId = newVer?.id || null;

        // ローカルPlanキャッシュも最新Verに更新 & 今日の実績を未入力にリセットして新カードを即時準備
        if (typeof window !== 'undefined') {
          try {
            const rawPlans = localStorage.getItem('pdca_local_plans');
            if (rawPlans) {
              const pList = JSON.parse(rawPlans).map((p: any) => {
                if (p.id === planData.id) {
                  return {
                    ...p,
                    currentVersion: {
                      id: newVer?.id || 'ver-' + Date.now(),
                      version_number: nextVerNum,
                      action_plan: revisionData.actionPlan,
                      target_value: revisionData.targetValue,
                      unit: revisionData.unit,
                      operator: revisionData.operator,
                      frequency: revisionData.frequency,
                      deadline: revisionData.deadline,
                    },
                    todayRecord: null, // Ver.2用の新しいカードとして未入力で初期化
                  };
                }
                return p;
              });
              localStorage.setItem('pdca_local_plans', JSON.stringify(pList));
            }
          } catch {}
        }
      } else if (actionType === 'terminate') {
        await supabase
          .from('plans')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', planData.id);
      }

      if (checkRecord?.id) {
        await supabase.from('actions').insert({
          check_id: checkRecord.id,
          plan_id: planData.id,
          user_id: userId,
          action_type: actionType,
          next_plan_version_id: nextPlanVersionId,
          reason: `${actionType} を選択`,
        });
      }

      // ローカルキャッシュ（pdca_local_checks）にも保存して即時反映を保証
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('pdca_local_checks');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift({
            id: checkRecord?.id || 'chk-' + Date.now(),
            plan_id: planData.id,
            plan_version_id: currentVersion.id,
            evaluation_date: new Date().toISOString().split('T')[0],
            is_achieved: objectiveOutcome === 'achieved',
            objective_outcome: objectiveOutcome,
            outcome_memo: outcomeMemo.trim(),
            target_summary: `大目的: ${planData.objectives?.title || planData.title}`,
            actual_summary: fullActualSummary,
            actions: [
              {
                action_type: actionType,
                reason: `${actionType} を選択`,
                created_at: new Date().toISOString(),
              },
            ],
            created_at: new Date().toISOString(),
          });
          localStorage.setItem('pdca_local_checks', JSON.stringify(list));
        } catch {}
      }

      window.dispatchEvent(new Event('pdca_plans_updated'));

      if (actionType === 'alternative') {
        router.push(`/plans/new?objective_id=${planData.objective_id}`);
      } else if (actionType === 'revise') {
        router.push(`/?new_version=${currentVersion.version_number + 1}`);
      } else {
        router.push('/history?check_completed=true');
      }
    } catch (err: any) {
      console.warn('Confirm Action Warning:', err);
      if (actionType === 'revise') {
        router.push(`/?new_version=${currentVersion.version_number + 1}`);
      } else {
        router.push('/history?check_completed=true');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs text-gray-500">照合データを集計中...</p>
      </div>
    );
  }

  if (!planData || errorMessage) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-red-600 font-bold">{errorMessage || 'Planが見つかりませんでした'}</p>
        <button
          onClick={() => router.push('/')}
          className="text-xs text-emerald-600 underline font-bold"
        >
          ホームに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-5 pb-12 animate-in fade-in duration-200">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {errorMessage}
        </div>
      )}

      {/* 行動目標(Plan)の実績検証 */}
      <CheckSummaryCard
        planTitle={planData.title}
        objectiveTitle={planData.objectives?.title || '目的'}
        targetCriteria={{
          targetValue: currentVersion.target_value,
          unit: currentVersion.unit,
          operator: currentVersion.operator,
          frequency: currentVersion.frequency,
          deadline: currentVersion.deadline,
          startDate: currentVersion.start_date,
        }}
        actualStats={{
          totalValue,
          averageValue,
          recordedDays,
          totalDays: totalPeriodDays,
          achievedDaysCount,
        }}
        isAchieved={isAchieved}
        checkStatus={checkStatus}
      />

      {/* STEP 1: 大目的の達成確認（4段階: 達成 / 未達成 / 中断 / 記録なし） */}
      <div className="bg-white border-2 border-emerald-500/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 inline-block mb-1.5">
            STEP 1 : 大目的の達成確認
          </span>
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-600 shrink-0" />
            大目的の成果を確認してください
          </h2>
          <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 leading-relaxed">
            {planData.objectives?.title || planData.title}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
            設定した期日を迎えた結果、この大目的は達成できましたか？以下の4段階から選択してください。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setObjectiveOutcome(opt.value)}
              className={`p-3 rounded-xl border text-left transition active:scale-[0.98] ${
                objectiveOutcome === opt.value
                  ? opt.activeClass
                  : opt.inactiveClass
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                <opt.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{opt.label}</span>
              </div>
              <p className="text-[10px] opacity-75 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="pt-1">
          <label className="text-[11px] font-semibold text-gray-600 block mb-1">
            成果のメモ・振り返り（任意）
          </label>
          <input
            type="text"
            value={outcomeMemo}
            onChange={(e) => setOutcomeMemo(e.target.value)}
            placeholder="例）体重は0.5kg減で目標の1kgには届かなかった、など"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* STEP 2: 次の方針を決定 (Action) */}
      <div className="space-y-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 inline-block mb-1">
          STEP 2 : 次の方針の決定 (Action)
        </span>
        <ActionSelector
          currentCriteria={{
            actionPlan: currentVersion.action_plan,
            targetValue: currentVersion.target_value,
            unit: currentVersion.unit,
            operator: currentVersion.operator,
            frequency: currentVersion.frequency,
            deadline: currentVersion.deadline,
            versionNumber: currentVersion.version_number,
          }}
          onConfirmAction={handleConfirmAction}
          isSubmitting={isSubmitting}
          checkStatus={checkStatus}
          actualStats={{
            recordedDays,
            totalDays: totalPeriodDays,
            averageValue,
          }}
        />
      </div>
    </div>
  );
}
