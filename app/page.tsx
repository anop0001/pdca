'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Sparkles, RefreshCw, X, Pencil, Trash2 } from 'lucide-react';
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

  // 編集用ステート
  const [editingPlan, setEditingPlan] = useState<PlanWithDetails | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTargetValue, setEditTargetValue] = useState<number>(1);
  const [editUnit, setEditUnit] = useState('回');
  const [editOperator, setEditOperator] = useState<'gte' | 'lte' | 'eq'>('gte');
  const [isUpdating, setIsUpdating] = useState(false);

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
          status: p.status,
          objectives: p.objectives,
          currentVersion,
          todayRecord: todayRecord
            ? {
                id: todayRecord.id,
                actual_value: todayRecord.actual_value,
                is_completed: todayRecord.is_completed,
              }
            : undefined,
        };
      });

      setPlans(formattedPlans);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // 実績保存ハンドラ
  const handleSaveRecord = async (planId: string, actualValue: number) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan || !targetPlan.currentVersion) return;

    const op = targetPlan.currentVersion.operator;
    const target = targetPlan.currentVersion.target_value;

    let completed = false;
    if (op === 'gte') completed = actualValue >= target;
    else if (op === 'lte') completed = actualValue <= target;
    else if (op === 'eq') completed = actualValue === target;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '00000000-0000-0000-0000-000000000001';

      if (targetPlan.todayRecord?.id) {
        await supabase
          .from('do_records')
          .update({
            actual_value: actualValue,
            is_completed: completed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetPlan.todayRecord.id);
      } else {
        const { data: newRec } = await supabase
          .from('do_records')
          .insert({
            plan_id: planId,
            user_id: userId,
            record_date: todayStr,
            actual_value: actualValue,
            is_completed: completed,
          })
          .select('id')
          .single();

        if (newRec) {
          targetPlan.todayRecord = {
            id: newRec.id,
            actual_value: actualValue,
            is_completed: completed,
          };
        }
      }

      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                todayRecord: {
                  id: p.todayRecord?.id || 'temp',
                  actual_value: actualValue,
                  is_completed: completed,
                },
              }
            : p
        )
      );

      if (completed) {
        showToast('🎉 目標達成！おめでとうございます！');
      } else {
        showToast('実績を記録しました');
      }
    } catch (err) {
      console.warn('Save record error:', err);
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                todayRecord: {
                  id: p.todayRecord?.id || 'temp',
                  actual_value: actualValue,
                  is_completed: completed,
                },
              }
            : p
        )
      );
      showToast('実績を記録しました');
    }
  };

  // 編集モーダルを開く
  const handleOpenEdit = (plan: PlanWithDetails) => {
    setEditingPlan(plan);
    setEditTitle(plan.title);
    setEditTargetValue(plan.currentVersion?.target_value ?? 1);
    setEditUnit(plan.currentVersion?.unit ?? '回');
    setEditOperator(plan.currentVersion?.operator ?? 'gte');
  };

  // Plan更新
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const newTitle = editTitle.trim();
    if (!newTitle) return;

    const newTargetVal = Number(editTargetValue);
    const newUnit = editUnit.trim() || '回';
    const newOperator = editOperator;

    setIsUpdating(true);
    try {
      await supabase
        .from('plans')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', editingPlan.id);

      if (editingPlan.currentVersion?.id) {
        await supabase
          .from('plan_versions')
          .update({
            action_plan: newTitle,
            target_value: newTargetVal,
            unit: newUnit,
            operator: newOperator,
          })
          .eq('id', editingPlan.currentVersion.id);
      }

      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === editingPlan.id) {
            return {
              ...p,
              title: newTitle,
              currentVersion: {
                ...p.currentVersion,
                action_plan: newTitle,
                target_value: newTargetVal,
                unit: newUnit,
                operator: newOperator,
              },
            };
          }
          return p;
        })
      );

      showToast('✅ Planを更新しました');
      setEditingPlan(null);
    } catch (err) {
      console.warn('Update Plan error:', err);
      showToast('Planを更新しました');
      setEditingPlan(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // Planの削除
  const handleDeletePlan = async (planId: string) => {
    const target = plans.find((p) => p.id === planId);
    const title = target?.title || 'このPlan';
    if (!confirm(`「${title}」を削除してもよろしいですか？\n※関連する実施記録も一緒に削除されます。`)) {
      return;
    }

    try {
      await supabase.from('plans').delete().eq('id', planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      showToast('🗑️ Planを削除しました');
    } catch (err) {
      console.warn('Delete warning:', err);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      showToast('🗑️ Planを削除しました');
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

        <div className="flex items-center gap-2">
          <Link
            href="/plans/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Plan作成
          </Link>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchDashboardData();
            }}
            disabled={refreshing || loading}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
            aria-label="更新"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
          <div className="flex flex-col gap-2 pt-1 items-center">
            <Link
              href="/plans/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm active:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Planを作成する
            </Link>
            <Link
              href="/help"
              className="text-[11px] text-slate-500 hover:text-emerald-700 font-semibold py-1 transition"
            >
              📖 初めての方へ：使い方マニュアルを見る
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <DoRecordCard
              key={plan.id}
              plan={plan}
              onSaveRecord={handleSaveRecord}
              onEdit={handleOpenEdit}
              onDelete={handleDeletePlan}
            />
          ))}
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="pt-2 text-center space-y-2">
          <div>
            <Link
              href="/plans/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 p-2"
            >
              <Plus className="w-4 h-4" />
              新しいPlanを追加する
            </Link>
          </div>
          <div>
            <Link
              href="/help"
              className="text-[11px] text-slate-400 hover:text-emerald-700 font-medium inline-flex items-center gap-1 transition"
            >
              <span>📖 使い方マニュアル・よくある質問</span>
            </Link>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Plan編集</span>
                <h3 className="text-sm font-extrabold text-slate-900">目標・判定基準の変更</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Planタイトル / 具体的な行動
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="例: 新規架電アプローチ"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">目標値</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editTargetValue}
                    onChange={(e) => setEditTargetValue(Number(e.target.value))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">単位</label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="件, 回, 分など"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">達成条件</label>
                <select
                  value={editOperator}
                  onChange={(e) => setEditOperator(e.target.value as 'gte' | 'lte' | 'eq')}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="gte">以上で達成 (≧)</option>
                  <option value="lte">以下で達成 (≦)</option>
                  <option value="eq">ぴったりで達成 (＝)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isUpdating ? '保存中...' : '変更を保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
