'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { CheckSummaryCard } from '@/components/plan-check/check-summary-card';
import { ActionSelector, type ActionType } from '@/components/plan-check/action-selector';

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

        if (data) {
          setPlanData(data as any);
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
            do_records: [],
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

  const currentVersion = (planData.plan_versions || []).sort(
    (a, b) => b.version_number - a.version_number
  )[0] || {
    id: 'v1',
    version_number: 1,
    action_plan: planData.title || 'Planアクション',
    target_value: 1,
    unit: '回',
    operator: 'gte' as const,
    frequency: 'daily',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
  };

  const records = planData.do_records || [];
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
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '00000000-0000-0000-0000-000000000001';

      const { data: checkRecord } = await supabase
        .from('checks')
        .insert({
          plan_id: planData.id,
          plan_version_id: currentVersion.id,
          user_id: userId,
          evaluation_date: new Date().toISOString().split('T')[0],
          is_achieved: isAchieved,
          target_summary: `目標: 毎日 ${currentVersion.target_value}${currentVersion.unit}`,
          actual_summary: `実績平均: ${averageValue}${currentVersion.unit} (記録 ${recordedDays}/${totalPeriodDays}日)`,
        })
        .select('id')
        .single();

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

      if (actionType === 'alternative') {
        router.push(`/plans/new?objective_id=${planData.objective_id}`);
      } else {
        router.push('/?action_completed=true');
      }
    } catch (err: any) {
      console.warn('Confirm Action Warning:', err);
      router.push('/?action_completed=true');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        ホームに戻る
      </button>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {errorMessage}
        </div>
      )}

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
      />

      <hr className="border-gray-100" />

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
      />
    </div>
  );
}
