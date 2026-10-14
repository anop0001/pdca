'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Clock, CheckCircle2, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ReviewModal, type ReviewTargetData } from '@/components/ReviewModal';

interface TeamTaskItem {
  planId: string;
  planTitle: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  status: 'check_pending' | 'revision_requested' | 'confirmed';
  deadline: string;
  latestReviewComment?: string;
  rawTargetData: ReviewTargetData;
}

export default function TeamDashboardPage() {
  const [tasks, setTasks] = useState<TeamTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ReviewTargetData | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'check_pending' | 'revision_requested' | 'confirmed'>('all');

  const fetchTeamStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data: memberships } = await supabase
        .from('memberships')
        .select(`
          user_id,
          users:user_id ( id, display_name, avatar_url )
        `)
        .eq('manager_id', user.id);

      if (!memberships || memberships.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const memberIds = memberships.map((m: any) => m.user_id);

      const { data: plansData, error } = await supabase
        .from('plans')
        .select(`
          id,
          title,
          user_id,
          organization_id,
          objectives ( title ),
          plan_versions (
            id,
            version_number,
            action_plan,
            target_value,
            unit,
            operator,
            deadline,
            start_date
          ),
          do_records (
            record_date,
            actual_value,
            is_completed
          ),
          checks (
            id,
            evaluation_date,
            is_achieved,
            actual_summary
          ),
          actions (
            action_type,
            reason
          ),
          reviews (
            id,
            status,
            comment,
            created_at
          )
        `)
        .in('user_id', memberIds)
        .not('organization_id', 'is', null)
        .eq('status', 'in_progress');

      if (error) throw error;

      const formattedList: TeamTaskItem[] = [];

      (plansData || []).forEach((p: any) => {
        const member = memberships.find((m: any) => m.user_id === p.user_id)?.users as any;
        const memberName = member?.display_name || 'メンバー';

        const latestVersion = (p.plan_versions || []).sort(
          (a: any, b: any) => b.version_number - a.version_number
        )[0];
        const latestCheck = (p.checks || []).sort(
          (a: any, b: any) => new Date(b.evaluation_date).getTime() - new Date(a.evaluation_date).getTime()
        )[0];
        const latestAction = p.actions?.[0];
        const latestReview = (p.reviews || []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        const records = p.do_records || [];
        const totalActual = records.reduce((sum: number, r: any) => sum + (r.actual_value || 0), 0);
        const recordedDays = records.length;

        let taskStatus: TeamTaskItem['status'] = 'confirmed';
        if (latestCheck) {
          if (!latestReview || new Date(latestCheck.evaluation_date) > new Date(latestReview.created_at)) {
            taskStatus = 'check_pending';
          } else if (latestReview.status === 'revision_requested') {
            taskStatus = 'revision_requested';
          } else if (latestReview.status === 'confirmed') {
            taskStatus = 'confirmed';
          }
        }

        const rawTargetData: ReviewTargetData = {
          planId: p.id,
          planTitle: p.title,
          memberName,
          versionNumber: latestVersion?.version_number || 1,
          actionPlan: latestVersion?.action_plan || p.title,
          targetValue: latestVersion?.target_value || 0,
          unit: latestVersion?.unit || '回',
          operator: latestVersion?.operator || 'gte',
          deadline: latestVersion?.deadline || '',
          totalActual,
          recordedDays,
          isAchieved: latestCheck?.is_achieved ?? false,
          actualSummary: latestCheck?.actual_summary || '未評価',
          actionType: latestAction?.action_type || '未選択',
          actionReason: latestAction?.reason,
        };

        formattedList.push({
          planId: p.id,
          planTitle: p.title,
          memberId: p.user_id,
          memberName,
          memberAvatar: member?.avatar_url,
          status: taskStatus,
          deadline: latestVersion?.deadline || '',
          latestReviewComment: latestReview?.comment,
          rawTargetData,
        });
      });

      setTasks(formattedList);
    } catch (err) {
      console.error('Fetch Team Status Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamStatus();
  }, [fetchTeamStatus]);

  const checkPendingCount = tasks.filter((t) => t.status === 'check_pending').length;
  const revisionCount = tasks.filter((t) => t.status === 'revision_requested').length;
  const confirmedCount = tasks.filter((t) => t.status === 'confirmed').length;

  const filteredTasks = currentFilter === 'all' ? tasks : tasks.filter((t) => t.status === currentFilter);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-16 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>チーム状況ダッシュボード</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 mt-0.5">サイクルの滞り検知</h1>
        </div>
        <button
          onClick={fetchTeamStatus}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setCurrentFilter(currentFilter === 'check_pending' ? 'all' : 'check_pending')}
          className={`p-3 rounded-2xl border text-center transition ${
            currentFilter === 'check_pending'
              ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
              : 'border-gray-200 bg-white'
          }`}
        >
          <span className="text-[10px] font-bold text-gray-500 block">確認待ち</span>
          <span className="text-xl font-black text-amber-600">{checkPendingCount}</span>
          <span className="text-[10px] text-gray-400 block mt-0.5">件 (要対応)</span>
        </button>

        <button
          onClick={() => setCurrentFilter(currentFilter === 'revision_requested' ? 'all' : 'revision_requested')}
          className={`p-3 rounded-2xl border text-center transition ${
            currentFilter === 'revision_requested'
              ? 'border-red-500 bg-red-50 ring-2 ring-red-400'
              : 'border-gray-200 bg-white'
          }`}
        >
          <span className="text-[10px] font-bold text-gray-500 block">再提出待ち</span>
          <span className="text-xl font-black text-red-600">{revisionCount}</span>
          <span className="text-[10px] text-gray-400 block mt-0.5">件 (メンバー)</span>
        </button>

        <button
          onClick={() => setCurrentFilter(currentFilter === 'confirmed' ? 'all' : 'confirmed')}
          className={`p-3 rounded-2xl border text-center transition ${
            currentFilter === 'confirmed'
              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400'
              : 'border-gray-200 bg-white'
          }`}
        >
          <span className="text-[10px] font-bold text-gray-500 block">確認完了</span>
          <span className="text-xl font-black text-emerald-600">{confirmedCount}</span>
          <span className="text-[10px] text-gray-400 block mt-0.5">件 (進行中)</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          チームの状況を集計中...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-gray-200 bg-gray-50/50 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-sm font-bold text-gray-800">サイクルの滞りはありません</p>
          <p className="text-xs text-gray-400">配下メンバー全員が順調に自走しています。</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <div
              key={task.planId}
              className="p-3.5 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                    {task.memberName.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-gray-900">{task.memberName}</span>
                </div>

                {task.status === 'check_pending' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Check確認待ち
                  </span>
                )}
                {task.status === 'revision_requested' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                    修正依頼中
                  </span>
                )}
                {task.status === 'confirmed' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    確認完了
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-gray-800 leading-snug">
                  {task.planTitle}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  期限: {task.deadline || '未設定'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(task.rawTargetData)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-98"
              >
                提出内容をレビューする
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <ReviewModal
          data={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onReviewSubmitted={() => {
            setSelectedTask(null);
            fetchTeamStatus();
          }}
        />
      )}
    </div>
  );
}
