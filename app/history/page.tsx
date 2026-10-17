'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  TrendingUp,
  ClipboardX,
  PauseCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';
import { useLiff } from '@/components/liff-provider';

interface ActionRecord {
  action_type: 'continue' | 'revise' | 'alternative' | 'terminate';
  reason?: string;
  created_at: string;
}

interface CheckRecord {
  id: string;
  evaluation_date: string;
  is_achieved: boolean;
  objective_outcome?: 'achieved' | 'unachieved' | 'suspended' | 'unrecorded';
  outcome_memo?: string;
  target_summary: string;
  actual_summary: string;
  actions?: ActionRecord[];
}

type ObjectiveOutcome = 'achieved' | 'unachieved' | 'suspended' | 'unrecorded';

function parseObjectiveOutcome(check?: CheckRecord): ObjectiveOutcome | null {
  if (!check) return null;
  if (check.objective_outcome) return check.objective_outcome;
  if (check.actual_summary) {
    if (check.actual_summary.includes('[大目的:達成]')) return 'achieved';
    if (check.actual_summary.includes('[大目的:未達成]')) return 'unachieved';
    if (check.actual_summary.includes('[大目的:中断]')) return 'suspended';
    if (check.actual_summary.includes('[大目的:記録なし]')) return 'unrecorded';
  }
  if (
    check.actual_summary?.includes('記録 0') ||
    check.actual_summary?.includes('記録なし') ||
    check.actual_summary?.includes('未記録')
  ) {
    return 'unrecorded';
  }
  return check.is_achieved ? 'achieved' : 'unachieved';
}

interface DoRecordItem {
  id: string;
  plan_id?: string;
  plan_version_id?: string;
  record_date: string;
  actual_value?: number;
  is_completed: boolean;
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
  do_records?: DoRecordItem[];
  plan_versions: PlanVersionRecord[];
}

interface ObjectiveGroup {
  id: string;
  title: string;
  status: string;
  plans: PlanRecord[];
}

function getTodayJSTString(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  const d = String(jst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface VersionStats {
  achieved: number;
  unachieved: number;
  unrecorded: number;
}

function computeVersionStats(
  ver: PlanVersionRecord,
  idx: number,
  allVersions: PlanVersionRecord[],
  doRecords: DoRecordItem[] = []
): VersionStats {
  const todayStr = getTodayJSTString();
  const isLatest = idx === allVersions.length - 1;

  // 開始日
  const startDateStr = ver.start_date || ver.created_at?.split('T')[0] || todayStr;

  // 終了日（このバージョンの期間末尾）
  let verEndDateStr = ver.deadline;
  if (!verEndDateStr) {
    const s = new Date(startDateStr);
    s.setDate(s.getDate() + 7);
    verEndDateStr = s.toISOString().split('T')[0];
  }

  // もし次のバージョンが存在する場合、次のバージョンの開始日を手前の上限とする
  if (!isLatest && allVersions[idx + 1]) {
    const nextVer = allVersions[idx + 1];
    const nextStart = nextVer.start_date || nextVer.created_at?.split('T')[0];
    if (nextStart && nextStart < verEndDateStr) {
      verEndDateStr = nextStart;
    }
  }

  // 評価対象の終了日（進行中の場合は今日まで、過去バージョンの場合はverEndDateStrまで）
  const evalEndStr = isLatest
    ? (todayStr < verEndDateStr ? todayStr : verEndDateStr)
    : verEndDateStr;

  // 日付リストを生成
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(evalEndStr);

  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
    const curr = new Date(start);
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = curr.getDay();

      // 平日限定プランで土日の場合はスキップ（ただし記録がある場合は後ほどカウント）
      const isWeekdayGoal = ver.frequency === 'weekday' || ver.frequency === '平日';
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekdayGoal || !isWeekend) {
        dates.push(dateStr);
      }
      curr.setDate(curr.getDate() + 1);
    }
  } else if (!isNaN(start.getTime())) {
    dates.push(startDateStr);
  }

  // このバージョンに関連するレコードを抽出
  const relevantRecords = doRecords.filter((r) => {
    if (r.plan_version_id) {
      return r.plan_version_id === ver.id;
    }
    // plan_version_idが無い旧レコード用のフォールバック（日付範囲）
    if (r.record_date && r.record_date >= startDateStr && r.record_date <= verEndDateStr) return true;
    return false;
  });

  const recordMap = new Map<string, DoRecordItem>();
  for (const r of relevantRecords) {
    if (r.record_date) {
      // 1日に複数ある場合は完了済みのものを優先
      if (!recordMap.has(r.record_date) || r.is_completed) {
        recordMap.set(r.record_date, r);
      }
    }
  }

  let achieved = 0;
  let unachieved = 0;
  let unrecorded = 0;

  const targetVal = Number(ver.target_value) || 1;

  for (const d of dates) {
    const rec = recordMap.get(d);
    if (!rec) {
      unrecorded++;
    } else {
      let isAch = false;
      if (rec.is_completed) {
        isAch = true;
      } else if (ver.unit === '回' && targetVal === 1) {
        isAch = Boolean(rec.is_completed);
      } else {
        const val = Number(rec.actual_value) || 0;
        switch (ver.operator) {
          case 'gte':
            isAch = val >= targetVal;
            break;
          case 'lte':
            isAch = val <= targetVal && val > 0;
            break;
          case 'eq':
            isAch = val === targetVal;
            break;
        }
      }
      if (isAch) {
        achieved++;
      } else {
        unachieved++;
      }
    }
  }

  // もしdatesリストに含まれていなかったが、relevantRecordsに記録がある日も加算
  for (const [d, rec] of Array.from(recordMap.entries())) {
    if (!dates.includes(d)) {
      if (rec.is_completed) achieved++;
      else unachieved++;
    }
  }

  // 過去のCheckデータがあり、レコードが0件だった場合のフォールバック補正
  if (achieved === 0 && unachieved === 0 && unrecorded === 0 && ver.checks && ver.checks.length > 0) {
    const check = ver.checks[0];
    if (check.is_achieved) {
      achieved = 1;
    } else if (check.actual_summary?.includes('未記録') || check.actual_summary?.includes('0日')) {
      unrecorded = 1;
    } else {
      unachieved = 1;
    }
  }

  return { achieved, unachieved, unrecorded };
}

export default function HistoryPage() {
  const { isReady, user: liffUser } = useLiff();
  const [objectives, setObjectives] = useState<ObjectiveGroup[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchHistoryData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. ローカルキャッシュに保存されているPlanのIDとデータを取得
      let localPlans: any[] = [];
      let localPlanIds: string[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('pdca_local_plans');
          if (raw) {
            localPlans = JSON.parse(raw);
            localPlanIds = localPlans.map((p: any) => p.id).filter(Boolean);
          }
        } catch {}
      }

      // 2. 現在のユーザーIDを特定
      const currentUserId = await getCurrentUserId(liffUser || undefined);

      // 3. ユーザーのPlanをSupabaseから取得（本人のuser_idに紐づくPlan）
      const fetchedPlansMap = new Map<string, any>();

      if (currentUserId) {
        const { data: userPlans, error: userPlansError } = await supabase
          .from('plans')
          .select(`
            id,
            user_id,
            title,
            status,
            objective_id,
            objectives (
              id,
              title,
              status
            ),
            do_records (
              id,
              plan_id,
              plan_version_id,
              record_date,
              actual_value,
              is_completed
            ),
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
          `)
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false });

        if (userPlansError) {
          console.warn('History fetch user plans error:', userPlansError);
        }

        if (userPlans) {
          for (const p of userPlans) {
            fetchedPlansMap.set(p.id, p);
          }
        }
      }

      // 4. 端末のローカルPlan IDのうち、まだ取得できていないものをSupabaseから直接ID指定で補完取得
      const missingIds = localPlanIds.filter((id) => !fetchedPlansMap.has(id));
      if (missingIds.length > 0) {
        try {
          const { data: missingPlans } = await supabase
            .from('plans')
            .select(`
              id,
              user_id,
              title,
              status,
              objective_id,
              objectives (
                id,
                title,
                status
              ),
              do_records (
                id,
                plan_id,
                plan_version_id,
                record_date,
                actual_value,
                is_completed
              ),
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
            `)
            .in('id', missingIds);

          if (missingPlans) {
            for (const p of missingPlans) {
              fetchedPlansMap.set(p.id, p);
            }
          }
        } catch (e) {
          console.warn('Missing plans fetch error:', e);
        }
      }

      // 5. SupabaseになかったローカルPlanも補完
      for (const lp of localPlans) {
        if (!fetchedPlansMap.has(lp.id)) {
          fetchedPlansMap.set(lp.id, {
            id: lp.id,
            title: lp.title,
            status: lp.status || 'in_progress',
            objective_id: lp.objective_id || '',
            objectives: {
              id: lp.objective_id || '',
              title: lp.objectiveTitle || '目標設定',
              status: 'active',
            },
            do_records: lp.do_records || (lp.todayRecord ? [{
              id: lp.todayRecord.id || 'rec-today',
              plan_id: lp.id,
              record_date: getTodayJSTString(),
              actual_value: lp.todayRecord.actual_value,
              is_completed: lp.todayRecord.is_completed,
            }] : []),
            plan_versions: [
              {
                id: lp.currentVersion?.id || 'v1',
                version_number: lp.currentVersion?.version_number || 1,
                action_plan: lp.currentVersion?.action_plan || lp.title,
                target_value: lp.currentVersion?.target_value || 1,
                unit: lp.currentVersion?.unit || '回',
                operator: lp.currentVersion?.operator || 'gte',
                frequency: lp.currentVersion?.frequency || 'daily',
                deadline: lp.currentVersion?.deadline || '',
                start_date: lp.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                created_at: lp.created_at || new Date().toISOString(),
                checks: [],
              },
            ],
          });
        }
      }

      // 5.5. ローカルストレージ（pdca_local_records & pdca_local_plans）の実績レコードを全Planのdo_recordsに合体反映
      const localRecordsMap = new Map<string, any[]>();
      if (typeof window !== 'undefined') {
        try {
          const recRaw = localStorage.getItem('pdca_local_records');
          if (recRaw) {
            const list = JSON.parse(recRaw);
            for (const r of list) {
              if (r.plan_id) {
                if (!localRecordsMap.has(r.plan_id)) localRecordsMap.set(r.plan_id, []);
                localRecordsMap.get(r.plan_id)!.push(r);
              }
            }
          }
        } catch {}

        try {
          const plansRaw = localStorage.getItem('pdca_local_plans');
          if (plansRaw) {
            const pList = JSON.parse(plansRaw);
            for (const lp of pList) {
              if (lp.id && lp.todayRecord) {
                if (!localRecordsMap.has(lp.id)) localRecordsMap.set(lp.id, []);
                const existing = localRecordsMap.get(lp.id)!;
                if (!existing.some((r) => r.record_date === getTodayJSTString())) {
                  existing.push({
                    id: lp.todayRecord.id || 'rec-today',
                    plan_id: lp.id,
                    record_date: getTodayJSTString(),
                    actual_value: lp.todayRecord.actual_value,
                    is_completed: lp.todayRecord.is_completed,
                  });
                }
              }
            }
          }
        } catch {}
      }

      for (const [pId, p] of Array.from(fetchedPlansMap.entries())) {
        const localRecs = localRecordsMap.get(pId) || [];
        if (!p.do_records) p.do_records = [];
        const existingDates = new Set((p.do_records || []).map((r: any) => r.record_date));

        for (const lr of localRecs) {
          if (!existingDates.has(lr.record_date)) {
            p.do_records.push(lr);
            existingDates.add(lr.record_date);
          } else {
            // 同日のレコードが存在する場合、最新のローカル入力値で上書き反映
            const idx = p.do_records.findIndex((r: any) => r.record_date === lr.record_date);
            if (idx >= 0 && lr.actual_value !== undefined) {
              p.do_records[idx] = { ...p.do_records[idx], ...lr };
            }
          }
        }
      }

      // 5.6. ローカルストレージ（pdca_local_checks）のチェック結果を各PlanVersionに合体反映
      const localChecksMap = new Map<string, any[]>();
      if (typeof window !== 'undefined') {
        try {
          const checksRaw = localStorage.getItem('pdca_local_checks');
          if (checksRaw) {
            const list = JSON.parse(checksRaw);
            for (const chk of list) {
              const vKey = chk.plan_version_id || chk.plan_id;
              if (vKey) {
                if (!localChecksMap.has(vKey)) localChecksMap.set(vKey, []);
                localChecksMap.get(vKey)!.push(chk);
              }
            }
          }
        } catch {}
      }

      for (const plan of Array.from(fetchedPlansMap.values())) {
        if (plan.plan_versions) {
          for (const ver of plan.plan_versions) {
            if (!ver.checks || ver.checks.length === 0) {
              const localChecks = localChecksMap.get(ver.id) || localChecksMap.get(plan.id) || [];
              if (localChecks.length > 0) {
                ver.checks = localChecks;
              }
            }
          }
        }
      }

      // 6. すべてのPlanを目標（Objective）ごとにグループ化
      const groupsMap = new Map<string, ObjectiveGroup>();

      for (const plan of Array.from(fetchedPlansMap.values())) {
        const objTitle = plan.objectives?.title || plan.objectiveTitle || '目標設定';
        const objId = plan.objective_id || plan.objectives?.id || `obj-${objTitle}`;

        if (!groupsMap.has(objId)) {
          groupsMap.set(objId, {
            id: objId,
            title: objTitle,
            status: plan.objectives?.status || 'active',
            plans: [],
          });
        }

        const sortedVersions = (plan.plan_versions || []).sort(
          (a: any, b: any) => a.version_number - b.version_number
        );

        groupsMap.get(objId)!.plans.push({
          id: plan.id,
          title: plan.title,
          status: plan.status,
          do_records: plan.do_records || [],
          plan_versions: sortedVersions,
        });
      }

      const formatted = Array.from(groupsMap.values());
      setObjectives(formatted);
    } catch (err) {
      console.error('Fetch History Error:', err);
    } finally {
      setLoading(false);
    }
  }, [liffUser]);

  useEffect(() => {
    if (!isReady) return;
    fetchHistoryData();
    window.addEventListener('pdca_plans_updated', fetchHistoryData);
    return () => {
      window.removeEventListener('pdca_plans_updated', fetchHistoryData);
    };
  }, [isReady, fetchHistoryData]);

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
                      const todayStr = getTodayJSTString();
                      const isLatest = idx === plan.plan_versions.length - 1;
                      const check = ver.checks?.[0];
                      const action = check?.actions?.[0];
                      const prevVer = idx > 0 ? plan.plan_versions[idx - 1] : null;

                      const isTargetChanged = prevVer && prevVer.target_value !== ver.target_value;
                      const stats = computeVersionStats(ver, idx, plan.plan_versions, plan.do_records || []);

                      // 期日到来判定 & 大目的4段階ステータス
                      const isExpired = Boolean(ver.deadline && ver.deadline <= todayStr);
                      const outcome = parseObjectiveOutcome(check);

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
                                ? isExpired && !check
                                  ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                                  : 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200/70'
                                : 'bg-gray-50/70 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                                Ver. {ver.version_number}
                                {check ? (
                                  outcome === 'achieved' ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      大目的: 達成 🎉
                                    </span>
                                  ) : outcome === 'unachieved' ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      大目的: 未達成 ⚠️
                                    </span>
                                  ) : outcome === 'suspended' ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-600 text-white flex items-center gap-1">
                                      <PauseCircle className="w-3 h-3" />
                                      大目的: 中断 ⏸️
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-600 text-white flex items-center gap-1">
                                      <ClipboardX className="w-3 h-3" />
                                      大目的: 記録なし 📝
                                    </span>
                                  )
                                ) : isLatest ? (
                                  isExpired ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-xs animate-pulse">
                                      <AlertTriangle className="w-3 h-3" />
                                      期日終了 (要Check)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                      現在進行中
                                    </span>
                                  )
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

                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-gray-800 leading-snug">
                                {ver.action_plan}
                              </p>
                              <Link
                                href={`/plans/${plan.id}/check`}
                                className="shrink-0 inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition active:scale-95 shadow-xs"
                              >
                                <span>Check ➔</span>
                              </Link>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-gray-500">判定基準:</span>
                              <span className="font-bold text-gray-800">
                                毎日 {ver.target_value} {ver.unit}
                                {ver.operator === 'gte' ? ' 以上' : ver.operator === 'lte' ? ' 以下' : ' 一致'}
                              </span>

                              {isTargetChanged && prevVer && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-extrabold text-[10px] ${
                                  ver.target_value > prevVer.target_value
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  <span>{prevVer.target_value}{prevVer.unit}</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                  <span>
                                    {ver.target_value}{ver.unit}
                                    {ver.target_value > prevVer.target_value ? '（引き上げ）' : '（引き下げ）'}
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* 達成 / 未達 / 未入力 カウント表示 */}
                            <div className="mt-2.5 pt-2 border-t border-gray-200/60">
                              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                                <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-xl py-1.5 px-2 text-center shadow-xs">
                                  <div className="text-[10px] font-bold text-emerald-800 flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>達成</span>
                                  </div>
                                  <div className="text-xs font-black text-emerald-700 mt-0.5">
                                    {stats.achieved}回
                                  </div>
                                </div>

                                <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl py-1.5 px-2 text-center shadow-xs">
                                  <div className="text-[10px] font-bold text-amber-800 flex items-center justify-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>未達</span>
                                  </div>
                                  <div className="text-xs font-black text-amber-700 mt-0.5">
                                    {stats.unachieved}回
                                  </div>
                                </div>

                                <div className="bg-slate-100/90 border border-slate-200 rounded-xl py-1.5 px-2 text-center shadow-xs">
                                  <div className="text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1">
                                    <ClipboardX className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>未入力</span>
                                  </div>
                                  <div className="text-xs font-black text-slate-700 mt-0.5">
                                    {stats.unrecorded}回
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 期日終了・大目的確認促進バナー */}
                            {!check && isLatest && isExpired && (
                              <div className="mt-2.5 pt-2 border-t border-amber-200/80">
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  <div className="space-y-1">
                                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>期日（{ver.deadline}）を迎えました</span>
                                    </div>
                                    <p className="text-[11px] text-amber-800 leading-snug">
                                      大目的「{obj.title}」の達成結果（達成・未達成・中断・記録なし）を確認し、次の方針（Action）を決定しましょう。
                                    </p>
                                  </div>
                                  <Link
                                    href={`/plans/${plan.id}/check`}
                                    className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-xs transition"
                                  >
                                    <span>大目的を確認・Check</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                </div>
                              </div>
                            )}


                            {check && (() => {
                              return (
                                <div className="mt-2.5 pt-2 border-t border-gray-200/70 space-y-2">
                                  {/* 大目的の確認結果 */}
                                  <div className="p-2.5 rounded-xl bg-gray-50/90 border border-gray-200/80 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-[11px] text-gray-500 font-bold flex items-center gap-1">
                                        <Target className="w-3 h-3 text-emerald-600 shrink-0" />
                                        大目的の達成確認:
                                      </span>
                                      {outcome === 'achieved' ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full">
                                          <CheckCircle2 className="w-3 h-3" />
                                          達成 🎉
                                        </span>
                                      ) : outcome === 'unachieved' ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-100/90 border border-rose-300 px-2 py-0.5 rounded-full">
                                          <AlertTriangle className="w-3 h-3" />
                                          未達成 ⚠️
                                        </span>
                                      ) : outcome === 'suspended' ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-orange-700 bg-orange-100/90 border border-orange-300 px-2 py-0.5 rounded-full">
                                          <PauseCircle className="w-3 h-3" />
                                          中断 ⏸️
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-700 bg-slate-200/90 border border-slate-300 px-2 py-0.5 rounded-full">
                                          <ClipboardX className="w-3 h-3" />
                                          記録なし 📝
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-gray-700 leading-relaxed bg-white p-2 rounded-lg border border-gray-100">
                                      {check.actual_summary}
                                    </p>
                                  </div>

                                  {/* 次の方針 (Action) */}
                                  {action && (
                                    <div className="flex items-center justify-between text-xs p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
                                      <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                                        <span>次の方針 (Action):</span>
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${
                                        ACTION_CONFIG[action.action_type]?.color || 'bg-gray-100 text-gray-700 border-gray-200'
                                      }`}>
                                        {React.createElement(ACTION_CONFIG[action.action_type]?.icon || RotateCw, { className: 'w-3 h-3' })}
                                        {ACTION_CONFIG[action.action_type]?.label || action.action_type}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
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
