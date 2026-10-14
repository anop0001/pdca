'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { DoRecordCard, type PlanWithDetails } from '@/components/do-record-card';

function getTodayJSTString(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  const d = String(jst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HomePage() {
  const [plans, setPlans] = useState<PlanWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayStr = getTodayJSTString();

  const todayFormatted = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select(`
          id,
          title,
          status,
          objectives ( id, title ),
          plan_versions (
            id,
            version_number,
            action_plan,
            target_value,
            unit,
            operator,
            frequency,
            deadline
          ),
          do_records (
            id,
            record_date,
            actual_value,
            is_completed
          )
        `)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false });

      if (plansError) {
        // 初期状態またはモックフォールバック
        console.warn('Plans fetch error:', plansError);
      }

      const formattedPlans: PlanWithDetails[] = (plansData || []).map((p: any) => {
        const sortedVersions = (p.plan_versions || []).sort(
          (a: any, b: any) => b.version_number - a.version_number
        );
        const currentVersion = sortedVersions[0] || {
          id: '',
          action_plan: p.title,
          target_value: 1,
          unit: '回',
          operator: 'gte',
          frequency: 'daily',
          deadline: '',
        };

        const todayRecord = (p.do_records || []).find(
          (r: any) => r.record_date === todayStr
        );

        return {
          id: p.id,
          title: p.title,
          objectiveTitle: p.objectives?.title || '目的未設定',
          currentVersion,
          todayRecord: todayRecord || null,
        };
      });

      setPlans(formattedPlans);
    } catch (err: any) {
      console.error('Fetch Dashboard Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSaveRecord = async (
    planId: string,
    versionId: string,
    actualValue: number,
    isCompleted: boolean
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast(isCompleted ? '🎉 達成を記録しました(ローカル)' : '実績を更新しました');
        return;
      }

      const { data, error } = await supabase
        .from('do_records')
        .upsert(
          {
            plan_id: planId,
            plan_version_id: versionId,
            user_id: user.id,
            record_date: todayStr,
            actual_value: actualValue,
            is_completed: isCompleted,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'plan_id, record_date',
          }
        )
        .select()
        .single();

      if (error) throw error;

      setPlans((prev) =>
        prev.map((item) => {
          if (item.id === planId) {
            return {
              ...item,
              todayRecord: {
                id: data.id,
                actual_value: actualValue,
                is_completed: isCompleted,
              },
            };
          }
          return item;
        })
      );

      showToast(isCompleted ? '🎉 達成を記録しました！' : '実績を保存しました');
    } catch (err: any) {
      console.error('Save Do Record Error:', err);
      showToast('保存に失敗しました');
    }
  };

  const completedCount = plans.filter((p) => p.todayRecord?.is_completed).length;
  const totalCount = plans.length;

  return (
    <div className="max-w-md mx-auto space-y-5 pb-8 animate-in fade-in duration-200">
      <div className="flex items-end justify-between pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{todayFormatted}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 mt-0.5">今日のPDCA</h1>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchDashboardData();
          }}
          disabled={refreshing || loading}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          aria-label="更新"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!loading && totalCount > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-emerald-100">本日の進捗状況</p>
            <p className="text-lg font-bold mt-0.5">
              {completedCount} / {totalCount} 完了
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-sm text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {completedCount === totalCount ? 'パーフェクト達成！' : 'あと少し！'}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-100 rounded w-12" />
              </div>
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-11 bg-gray-100 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">進行中のPlanがありません</h3>
            <p className="text-xs text-gray-500 mt-1">
              まずは目標達成に向けた最初のPlanを作ってみましょう。
            </p>
          </div>
          <Link
            href="/plans/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm active:bg-emerald-700 transition"
          >
            <Plus className="w-4 h-4" />
            Planを作成する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <DoRecordCard
              key={plan.id}
              plan={plan}
              onSaveRecord={handleSaveRecord}
            />
          ))}
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="pt-2 text-center">
          <Link
            href="/plans/new"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 p-2"
          >
            <Plus className="w-4 h-4" />
            新しいPlanを追加する
          </Link>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
