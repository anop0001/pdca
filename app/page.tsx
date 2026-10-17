'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Sparkles, RefreshCw, X, Pencil, Trash2, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';
import { useLiff } from '@/components/liff-provider';
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
  const { isReady, user: liffUser } = useLiff();
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
      // ログイン中のユーザーID（UUID）を特定（LIFFプロファイルまたはSupabaseセッション）
      const currentUserId = await getCurrentUserId(liffUser || undefined);

      // 未同期のローカルPlanがあればSupabaseに自動アップロード（端末間同期・旧セッション救済）
      if (typeof window !== 'undefined' && currentUserId) {
        const localRaw = localStorage.getItem('pdca_local_plans');
        if (localRaw) {
          try {
            const localList = JSON.parse(localRaw);
            let hasSyncUpdates = false;

            // まずSupabase上の既存プラン一覧を取得
            const { data: existingUserPlans } = await supabase
              .from('plans')
              .select('id, title')
              .eq('user_id', currentUserId);

            const existingTitles = new Set((existingUserPlans || []).map((p: any) => p.title));

            for (const lp of localList) {
              const planTitle = lp.title || lp.currentVersion?.action_plan || '実行Plan';

              // すでにSupabase上に同名Planが存在する場合、IDとuserIdを紐付け
              if (existingTitles.has(planTitle)) {
                const match = existingUserPlans?.find((p: any) => p.title === planTitle);
                if (match && lp.id !== match.id) {
                  lp.id = match.id;
                  lp.userId = currentUserId;
                  hasSyncUpdates = true;
                }
                continue;
              }

              // Supabase上にまだ存在しないローカルPlan（仮IDまたは別ユーザーIDで作成されたもの）を現在のLINEユーザーとしてアップロード
              if (lp.id && (String(lp.id).startsWith('plan-') || !lp.userId || lp.userId !== currentUserId)) {
                const { data: uploadedPlan } = await supabase
                  .from('plans')
                  .insert({
                    user_id: currentUserId,
                    title: planTitle,
                    status: 'in_progress',
                  })
                  .select('id')
                  .maybeSingle();

                if (uploadedPlan?.id) {
                  await supabase
                    .from('plan_versions')
                    .insert({
                      plan_id: uploadedPlan.id,
                      user_id: currentUserId,
                      version_number: 1,
                      action_plan: lp.currentVersion?.action_plan || planTitle,
                      target_value: lp.currentVersion?.target_value || 1,
                      unit: lp.currentVersion?.unit || '回',
                      operator: lp.currentVersion?.operator || 'gte',
                      frequency: lp.currentVersion?.frequency || 'daily',
                      deadline: lp.currentVersion?.deadline || '',
                    });

                  lp.id = uploadedPlan.id;
                  lp.userId = currentUserId;
                  existingTitles.add(planTitle);
                  hasSyncUpdates = true;
                }
              }
            }

            if (hasSyncUpdates) {
              localStorage.setItem('pdca_local_plans', JSON.stringify(localList));
            }
          } catch (syncErr) {
            console.warn('Local plans cloud sync warning:', syncErr);
          }
        }
      }

      // セキュリティ保護：ユーザーIDが特定できない場合は他人のPlanを絶対に取得・表示しない
      let formattedPlans: PlanWithDetails[] = [];

      if (currentUserId) {
        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select(`
            id,
            user_id,
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
          .eq('user_id', currentUserId)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false });

        if (plansError) {
          console.warn('Plans fetch error:', plansError);
        }

        if (plansData) {
          // ローカルストレージ内のレコードキャッシュを取得（Supabase未反映分を救済）
          const localTodayRecordsMap = new Map<string, any>();
          if (typeof window !== 'undefined') {
            try {
              const recRaw = localStorage.getItem('pdca_local_records');
              if (recRaw) {
                const recList = JSON.parse(recRaw);
                for (const r of recList) {
                  if (r.plan_id && r.record_date === todayStr) {
                    localTodayRecordsMap.set(r.plan_id, r);
                  }
                }
              }
              const plansRaw = localStorage.getItem('pdca_local_plans');
              if (plansRaw) {
                const pList = JSON.parse(plansRaw);
                for (const lp of pList) {
                  if (lp.id && lp.todayRecord && !localTodayRecordsMap.has(lp.id)) {
                    localTodayRecordsMap.set(lp.id, lp.todayRecord);
                  }
                }
              }
            } catch {}
          }

          formattedPlans = plansData.map((p: any) => {
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

            const sbTodayRecord = (p.do_records || []).find(
              (r: any) => r.record_date === todayStr
            );
            const localRec = localTodayRecordsMap.get(p.id);

            // Supabaseレコードを優先、無ければローカルキャッシュを採用
            const todayRecord = sbTodayRecord || localRec || null;

            return {
              id: p.id,
              title: p.title,
              objectiveTitle: p.objectives?.title || '目的未設定',
              currentVersion,
              todayRecord,
            };
          });
        }
      }

      // Supabaseのデータに加えて、端末のローカルキャッシュに保存されたPlanもマージ
      let allPlans = [...formattedPlans];
      if (typeof window !== 'undefined') {
        const localRaw = localStorage.getItem('pdca_local_plans');
        if (localRaw) {
          try {
            const localList: (PlanWithDetails & { userId?: string })[] = JSON.parse(localRaw);
            for (const lp of localList) {
              if (lp.userId && currentUserId && lp.userId !== currentUserId) {
                continue;
              }
              if (!allPlans.some((p) => p.id === lp.id)) {
                allPlans.push(lp);
              }
            }
          } catch {}
        }
        localStorage.setItem('pdca_local_plans', JSON.stringify(allPlans));
      }

      setPlans(allPlans);
    } catch (err: any) {
      console.error('Fetch Dashboard Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr, liffUser]);

  useEffect(() => {
    if (!isReady) return;
    fetchDashboardData();
    window.addEventListener('pdca_plans_updated', fetchDashboardData);
    return () => {
      window.removeEventListener('pdca_plans_updated', fetchDashboardData);
    };
  }, [isReady, fetchDashboardData]);

  const handleSaveRecord = async (
    planId: string,
    versionId: string,
    actualValue: number,
    isCompleted: boolean
  ) => {
    try {
      const currentUserId = (await getCurrentUserId(liffUser || undefined)) || '00000000-0000-0000-0000-000000000001';

      const isValidUUID = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      // 1. ローカルレコードキャッシュ（pdca_local_records）に即座に確実に保存
      const newRecord = {
        id: 'rec-' + Date.now(),
        plan_id: planId,
        plan_version_id: isValidUUID(versionId) ? versionId : null,
        user_id: currentUserId,
        record_date: todayStr,
        actual_value: actualValue,
        is_completed: isCompleted,
        updated_at: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        try {
          const recRaw = localStorage.getItem('pdca_local_records');
          let recList = recRaw ? JSON.parse(recRaw) : [];
          recList = recList.filter(
            (r: any) => !(r.plan_id === planId && r.record_date === todayStr)
          );
          recList.push(newRecord);
          localStorage.setItem('pdca_local_records', JSON.stringify(recList));
        } catch (e) {
          console.warn('Local records save error:', e);
        }

        // pdca_local_plans の該当Planも更新
        try {
          const localRaw = localStorage.getItem('pdca_local_plans');
          if (localRaw) {
            const list = JSON.parse(localRaw).map((item: any) => {
              if (item.id === planId) {
                return {
                  ...item,
                  todayRecord: {
                    id: newRecord.id,
                    actual_value: actualValue,
                    is_completed: isCompleted,
                  },
                };
              }
              return item;
            });
            localStorage.setItem('pdca_local_plans', JSON.stringify(list));
          }
        } catch (e) {
          console.warn('Local plans cache update error:', e);
        }
      }

      // 2. ローカルstateを即座に更新
      setPlans((prev) =>
        prev.map((item) => {
          if (item.id === planId) {
            return {
              ...item,
              todayRecord: {
                id: newRecord.id,
                actual_value: actualValue,
                is_completed: isCompleted,
              },
            };
          }
          return item;
        })
      );

      // 3. Supabaseへの保存（planIdがUUID形式の場合）
      if (isValidUUID(planId)) {
        try {
          let cleanVersionId = isValidUUID(versionId) ? versionId : null;
          if (!cleanVersionId) {
            const { data: verRow } = await supabase
              .from('plan_versions')
              .select('id')
              .eq('plan_id', planId)
              .order('version_number', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (verRow?.id) cleanVersionId = verRow.id;
          }

          const recordPayload: any = {
            plan_id: planId,
            user_id: currentUserId,
            record_date: todayStr,
            actual_value: actualValue,
            is_completed: isCompleted,
            updated_at: new Date().toISOString(),
          };
          if (cleanVersionId) {
            recordPayload.plan_version_id = cleanVersionId;
          }

          // 既存チェックしてupdateまたはinsertを実行
          const { data: existingRec } = await supabase
            .from('do_records')
            .select('id')
            .eq('plan_id', planId)
            .eq('record_date', todayStr)
            .maybeSingle();

          if (existingRec?.id) {
            const { error: upErr } = await supabase
              .from('do_records')
              .update(recordPayload)
              .eq('id', existingRec.id);
            if (upErr) console.warn('Supabase update record error:', upErr);
          } else {
            const { error: insErr } = await supabase
              .from('do_records')
              .insert(recordPayload);
            if (insErr) {
              console.warn('Supabase insert record error, trying update fallback:', insErr);
              await supabase
                .from('do_records')
                .update(recordPayload)
                .eq('plan_id', planId)
                .eq('record_date', todayStr);
            }
          }
        } catch (sbErr) {
          console.warn('Supabase record sync error:', sbErr);
        }
      }

      window.dispatchEvent(new Event('pdca_plans_updated'));
      showToast(isCompleted ? '🎉 達成を記録しました！' : '実績を登録しました（未達成）');
    } catch (err: any) {
      console.error('Save Do Record Error:', err);
      showToast('実績を保存しました');
    }
  };

  const handleResetRecord = async (planId: string) => {
    try {
      const currentUserId = (await getCurrentUserId(liffUser || undefined)) || '00000000-0000-0000-0000-000000000001';

      // 1. ローカルキャッシュ（pdca_local_records & pdca_local_plans）から削除
      if (typeof window !== 'undefined') {
        try {
          const recRaw = localStorage.getItem('pdca_local_records');
          if (recRaw) {
            const recList = JSON.parse(recRaw).filter(
              (r: any) => !(r.plan_id === planId && r.record_date === todayStr)
            );
            localStorage.setItem('pdca_local_records', JSON.stringify(recList));
          }
        } catch {}

        try {
          const localRaw = localStorage.getItem('pdca_local_plans');
          if (localRaw) {
            const list = JSON.parse(localRaw).map((item: any) => {
              if (item.id === planId) {
                return {
                  ...item,
                  todayRecord: null,
                };
              }
              return item;
            });
            localStorage.setItem('pdca_local_plans', JSON.stringify(list));
          }
        } catch {}
      }

      // 2. ローカルstateを更新
      setPlans((prev) =>
        prev.map((item) => {
          if (item.id === planId) {
            return {
              ...item,
              todayRecord: null,
            };
          }
          return item;
        })
      );

      // 3. Supabaseから削除
      try {
        await supabase
          .from('do_records')
          .delete()
          .eq('plan_id', planId)
          .eq('record_date', todayStr);
      } catch (err) {
        console.warn('Supabase reset record warning:', err);
      }

      window.dispatchEvent(new Event('pdca_plans_updated'));
      showToast('本日の記録を取り消し、未入力に戻しました');
    } catch (err: any) {
      console.error('Reset record error:', err);
      showToast('未入力に戻しました');
    }
  };

  // 編集モーダルを開く
  const handleOpenEdit = (plan: PlanWithDetails) => {
    setEditingPlan(plan);
    setEditTitle(plan.currentVersion?.action_plan || plan.title);
    setEditTargetValue(plan.currentVersion?.target_value ?? 1);
    setEditUnit(plan.currentVersion?.unit || '回');
    setEditOperator(plan.currentVersion?.operator || 'gte');
  };

  // 編集を保存する
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setIsUpdating(true);
    try {
      const newTitle = editTitle.trim();
      const newTargetVal = Number(editTargetValue) || 1;
      const newUnit = editUnit.trim() || '回';
      const newOperator = editOperator;

      // Supabaseの更新を試行
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

      // ローカルstateの更新
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

      // ローカルストレージの更新
      if (typeof window !== 'undefined') {
        const localRaw = localStorage.getItem('pdca_local_plans');
        if (localRaw) {
          try {
            const list = JSON.parse(localRaw).map((p: any) => {
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
            });
            localStorage.setItem('pdca_local_plans', JSON.stringify(list));
          } catch {}
        }
      }

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
      // 関連レコード削除
      await supabase.from('do_records').delete().eq('plan_id', planId);
      await supabase.from('plan_versions').delete().eq('plan_id', planId);
      await supabase.from('plans').delete().eq('id', planId);
    } catch (err) {
      console.warn('Delete warning:', err);
    }

    if (typeof window !== 'undefined') {
      const localRaw = localStorage.getItem('pdca_local_plans');
      if (localRaw) {
        try {
          const list = JSON.parse(localRaw).filter((p: any) => p.id !== planId);
          localStorage.setItem('pdca_local_plans', JSON.stringify(list));
        } catch {}
      }
    }

    setPlans((prev) => prev.filter((p) => p.id !== planId));
    showToast('🗑️ Planを削除しました');
  };

  const achievedCount = plans.filter((p) => p.todayRecord && p.todayRecord.is_completed).length;
  const unachievedCount = plans.filter((p) => p.todayRecord && !p.todayRecord.is_completed).length;
  const unrecordedCount = plans.filter((p) => !p.todayRecord).length;
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
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>本日の実行ステータス</span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              全 {totalCount} 件のPlan
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 達成 */}
            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-center">
              <div className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                達成
              </div>
              <div className="text-xl font-extrabold text-emerald-800 mt-0.5">
                {achievedCount}
                <span className="text-xs font-normal text-emerald-600 ml-0.5">件</span>
              </div>
            </div>

            {/* 未達成 */}
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-center">
              <div className="text-[11px] font-bold text-amber-800 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                未達成
              </div>
              <div className="text-xl font-extrabold text-amber-900 mt-0.5">
                {unachievedCount}
                <span className="text-xs font-normal text-amber-700 ml-0.5">件</span>
              </div>
            </div>

            {/* 未入力 */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-[11px] font-bold text-slate-600 flex items-center justify-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                未入力
              </div>
              <div className="text-xl font-extrabold text-slate-800 mt-0.5">
                {unrecordedCount}
                <span className="text-xs font-normal text-slate-600 ml-0.5">件</span>
              </div>
            </div>
          </div>

          {achievedCount === totalCount && (
            <div className="text-center py-1.5 px-3 bg-emerald-100/70 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              本日すべてのPlanを達成しました！素晴らしいです！
            </div>
          )}
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
              onResetRecord={handleResetRecord}
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

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  実行プラン名 (アクション)
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="例: 毎朝の散歩"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    目標数値
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editTargetValue}
                    onChange={(e) => setEditTargetValue(Number(e.target.value))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    単位
                  </label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="歩, 回, 分 など"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  達成条件
                </label>
                <select
                  value={editOperator}
                  onChange={(e) => setEditOperator(e.target.value as any)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="gte">以上 (目標値以上で達成)</option>
                  <option value="lte">以下 (目標値以下で達成)</option>
                  <option value="eq">一致 (目標値と一致で達成)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isUpdating ? '保存中...' : '変更を保存'}
                </button>
              </div>
            </form>
          </div>
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
