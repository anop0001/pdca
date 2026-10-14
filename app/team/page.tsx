'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  Link as LinkIcon,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  X,
  Copy,
  Check,
  Clock,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ReviewModal, type ReviewTargetData } from '@/components/ReviewModal';

interface TeamTaskItem {
  planId: string;
  planTitle: string;
  memberId: string;
  memberName: string;
  status: 'check_pending' | 'revision_requested' | 'confirmed';
  deadline: string;
  latestReviewComment?: string;
  rawTargetData: ReviewTargetData;
}

interface TeamMember {
  id: string;
  name: string;
  role: 'manager' | 'member';
  planTitle?: string;
  joinedAt: string;
}

interface Organization {
  id: string;
  name: string;
  inviteCode: string;
}

const STORAGE_KEY_TEAM = 'pdca_team_info';
const STORAGE_KEY_MEMBERS = 'pdca_team_members';
const STORAGE_KEY_TASKS = 'pdca_team_tasks';

export default function TeamDashboardPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TeamTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stalls' | 'members'>('stalls');
  const [currentFilter, setCurrentFilter] = useState<'all' | 'check_pending' | 'revision_requested' | 'confirmed'>('all');

  // モーダル状態
  const [selectedTask, setSelectedTask] = useState<ReviewTargetData | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // フォーム状態
  const [teamNameInput, setTeamNameInput] = useState('');
  const [memberNameInput, setMemberNameInput] = useState('');
  const [memberPlanInput, setMemberPlanInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // デモデータ生成
  const loadDemoData = useCallback(() => {
    const demoOrg: Organization = {
      id: 'demo-org-anop',
      name: 'ANOP セールスチーム',
      inviteCode: 'ANOP-2026',
    };

    const demoMembers: TeamMember[] = [
      { id: 'm-0', name: 'あなた (管理者)', role: 'manager', joinedAt: '2026-10-01' },
      { id: 'm-1', name: '田中 健太', role: 'member', planTitle: '新規架電アプローチ (目標: 20件/日)', joinedAt: '2026-10-05' },
      { id: 'm-2', name: '佐藤 茜', role: 'member', planTitle: '商談後の即時議事録送付', joinedAt: '2026-10-07' },
      { id: 'm-3', name: '山田 太郎', role: 'member', planTitle: '毎日3件の既存フォロー連絡', joinedAt: '2026-10-09' },
    ];

    const demoTasks: TeamTaskItem[] = [
      {
        planId: 'plan-tanaka-1',
        planTitle: '新規架電アプローチ (目標: 20件/日)',
        memberId: 'm-1',
        memberName: '田中 健太',
        status: 'check_pending',
        deadline: '2026-10-18',
        rawTargetData: {
          planId: 'plan-tanaka-1',
          planTitle: '新規架電アプローチ',
          memberName: '田中 健太',
          versionNumber: 1,
          actionPlan: '確度の高い見込み先リストに対し、毎日20件の架電を行う',
          targetValue: 20,
          unit: '件',
          operator: 'gte',
          deadline: '2026-10-18',
          totalActual: 85,
          recordedDays: 7,
          isAchieved: false,
          actualSummary: 'トークスクリプト改善前で受付ブロックが多く、目標未達成',
          actionType: 'revise',
          actionReason: '次期スクリプトを短縮版に変えて受付突破率を向上させる',
        },
      },
      {
        planId: 'plan-sato-1',
        planTitle: '商談後の即時議事録送付',
        memberId: 'm-2',
        memberName: '佐藤 茜',
        status: 'revision_requested',
        deadline: '2026-10-15',
        latestReviewComment: '目標値の具体化を依頼中: 「商談後30分以内」等の明確な時間を設定しましょう。',
        rawTargetData: {
          planId: 'plan-sato-1',
          planTitle: '商談後の即時議事録送付',
          memberName: '佐藤 茜',
          versionNumber: 1,
          actionPlan: '全商談終了後、当日のうちに顧客へ要点サマリーメールを送る',
          targetValue: 1,
          unit: '回',
          operator: 'gte',
          deadline: '2026-10-15',
          totalActual: 3,
          recordedDays: 5,
          isAchieved: false,
          actualSummary: '連続商談が重なった日に当日送信が漏れた',
          actionType: 'revise',
          actionReason: '商談スロット間に15分のバッファを確保するルールに変更',
        },
      },
      {
        planId: 'plan-yamada-1',
        planTitle: '毎日3件の既存フォロー連絡',
        memberId: 'm-3',
        memberName: '山田 太郎',
        status: 'confirmed',
        deadline: '2026-10-20',
        latestReviewComment: '素晴らしい継続力です！この調子で今週も完走しましょう。',
        rawTargetData: {
          planId: 'plan-yamada-1',
          planTitle: '既存フォロー連絡',
          memberName: '山田 太郎',
          versionNumber: 1,
          actionPlan: '休眠顧客リストから毎日3件選んで近況確認のLINE/メールを送る',
          targetValue: 3,
          unit: '件',
          operator: 'gte',
          deadline: '2026-10-20',
          totalActual: 21,
          recordedDays: 7,
          isAchieved: true,
          actualSummary: '毎日午前中に固定で連絡し、目標21件を完全達成！',
          actionType: 'continue',
        },
      },
    ];

    setOrg(demoOrg);
    setMembers(demoMembers);
    setTasks(demoTasks);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(demoOrg));
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(demoMembers));
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(demoTasks));
    }

    showToast('⚡ デモ用チームとメンバー（田中・佐藤・山田）を読み込みました！');
  }, []);

  // 初期化 & データ取得
  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        const cachedOrg = localStorage.getItem(STORAGE_KEY_TEAM);
        const cachedMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);
        const cachedTasks = localStorage.getItem(STORAGE_KEY_TASKS);

        if (cachedOrg) {
          setOrg(JSON.parse(cachedOrg));
          if (cachedMembers) setMembers(JSON.parse(cachedMembers));
          if (cachedTasks) setTasks(JSON.parse(cachedTasks));
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memberships } = await supabase
          .from('memberships')
          .select(`
            id,
            role,
            organization_id,
            organizations:organization_id ( id, name, invite_code )
          `)
          .eq('user_id', user.id)
          .eq('role', 'manager')
          .maybeSingle();

        if (memberships?.organizations) {
          const orgData = memberships.organizations as any;
          const loadedOrg = {
            id: orgData.id,
            name: orgData.name,
            inviteCode: orgData.invite_code || 'PDCA-1234',
          };
          setOrg(loadedOrg);
          localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(loadedOrg));
        }
      }
    } catch (err) {
      console.warn('Supabase fetch error, fallback to local store:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // チーム開設（管理者登録）
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamNameInput.trim()) return;

    const code = 'TEAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newOrg: Organization = {
      id: 'org-' + Date.now(),
      name: teamNameInput.trim(),
      inviteCode: code,
    };

    const initialMembers: TeamMember[] = [
      { id: 'm-manager', name: 'あなた (管理者)', role: 'manager', joinedAt: new Date().toISOString().split('T')[0] },
    ];

    setOrg(newOrg);
    setMembers(initialMembers);
    setTasks([]);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(newOrg));
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(initialMembers));
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify([]));
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '00000000-0000-0000-0000-000000000001';
      const { data: orgDb } = await supabase
        .from('organizations')
        .insert({ name: newOrg.name, invite_code: code })
        .select()
        .single();

      if (orgDb) {
        await supabase.from('memberships').insert({
          organization_id: orgDb.id,
          user_id: userId,
          role: 'manager',
          member_name: '管理者',
        });
      }
    } catch (e) {
      console.warn('Supabase sync skipped:', e);
    }

    setShowCreateTeamModal(false);
    setTeamNameInput('');
    showToast(`🎉 チーム「${newOrg.name}」を開設しました！`);
  };

  // メンバー追加
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberNameInput.trim() || !org) return;

    const memberId = 'm-' + Date.now();
    const planTitle = memberPlanInput.trim() || '日次業務の目標達成';

    const newMember: TeamMember = {
      id: memberId,
      name: memberNameInput.trim(),
      role: 'member',
      planTitle,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    const newTask: TeamTaskItem = {
      planId: 'plan-' + Date.now(),
      planTitle,
      memberId,
      memberName: newMember.name,
      status: 'check_pending',
      deadline: '2026-10-31',
      rawTargetData: {
        planId: 'plan-' + Date.now(),
        planTitle,
        memberName: newMember.name,
        versionNumber: 1,
        actionPlan: planTitle,
        targetValue: 1,
        unit: '回',
        operator: 'gte',
        deadline: '2026-10-31',
        totalActual: 0,
        recordedDays: 3,
        isAchieved: false,
        actualSummary: '初期サイクル進行中（要確認）',
        actionType: 'continue',
      },
    };

    const updatedMembers = [...members, newMember];
    const updatedTasks = [newTask, ...tasks];

    setMembers(updatedMembers);
    setTasks(updatedTasks);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(updatedMembers));
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(updatedTasks));
    }

    setShowAddMemberModal(false);
    setMemberNameInput('');
    setMemberPlanInput('');
    showToast(`👤 メンバー「${newMember.name}」を追加しました！`);
  };

  // メンバー削除
  const handleDeleteMember = (memberId: string) => {
    if (!confirm('このメンバーをチームから解除しますか？')) return;

    const updatedMembers = members.filter((m) => m.id !== memberId);
    const updatedTasks = tasks.filter((t) => t.memberId !== memberId);

    setMembers(updatedMembers);
    setTasks(updatedTasks);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(updatedMembers));
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(updatedTasks));
    }
    showToast('メンバーを解除しました。');
  };

  // レビュー送信完了時の反映
  const handleReviewSubmitted = (actionType?: string, comment?: string) => {
    if (!selectedTask) return;

    const nextStatus = actionType === 'revision_requested' ? 'revision_requested' : 'confirmed';

    const updatedTasks: TeamTaskItem[] = tasks.map((t) => {
      if (t.planId === selectedTask.planId) {
        return {
          ...t,
          status: nextStatus,
          latestReviewComment: comment || 'レビュー完了',
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(updatedTasks));
    }

    setSelectedTask(null);
    showToast(nextStatus === 'confirmed' ? '✅ レビュー（確認完了）を送信しました！' : '💬 修正依頼を送信しました！');
  };

  // 招待URLコピー
  const handleCopyInvite = () => {
    if (!org) return;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/join?code=${org.inviteCode}` : '';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkPendingCount = tasks.filter((t) => t.status === 'check_pending').length;
  const revisionCount = tasks.filter((t) => t.status === 'revision_requested').length;
  const confirmedCount = tasks.filter((t) => t.status === 'confirmed').length;

  const filteredTasks = currentFilter === 'all' ? tasks : tasks.filter((t) => t.status === currentFilter);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-16 animate-in fade-in duration-200">
      {/* トースト表示 */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* チーム未登録の場合：開設・デモ導入カード */}
      {!org ? (
        <div className="p-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              👑
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">チーム管理機能</span>
              <h1 className="text-base font-extrabold text-slate-900">管理者登録 & チーム開設</h1>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            直属メンバーのPDCAサイクルの<strong>滞り（未達・評価遅れ）</strong>をリアルタイムに検知し、問いかけやレビューを行うダッシュボードです。
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>＋ 新しいチームを開設して管理者になる</span>
            </button>

            <button
              onClick={loadDemoData}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ デモ用メンバー（田中・佐藤・山田）を読み込む</span>
            </button>
          </div>
        </div>
      ) : (
        /* チーム登録済みの場合：ダッシュボード表示 */
        <>
          {/* 上部チームヘッダー */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{org.name}（メンバー {members.length}名）</span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">サイクルの滞り検知</h1>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
                管理者モード
              </span>
              <button
                onClick={fetchTeamData}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                title="更新"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* クイック操作ツールバー（メンバー追加 / 招待URL / デモ再読込） */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>メンバー追加</span>
            </button>

            <button
              onClick={() => setShowInviteModal(true)}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
            >
              <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>招待コード</span>
            </button>

            <button
              onClick={loadDemoData}
              className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center"
              title="デモ状態にリセット"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>

          {/* サマリー数値バッジ（デモ版と一致） */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setCurrentFilter(currentFilter === 'check_pending' ? 'all' : 'check_pending')}
              className={`p-3 rounded-2xl border text-center transition ${
                currentFilter === 'check_pending'
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="text-[10px] font-bold text-amber-700 block">確認待ち</span>
              <span className="text-xl font-black text-amber-600">{checkPendingCount}</span>
              <span className="text-[9px] text-amber-700 block">件 (要対応)</span>
            </button>

            <button
              onClick={() => setCurrentFilter(currentFilter === 'revision_requested' ? 'all' : 'revision_requested')}
              className={`p-3 rounded-2xl border text-center transition ${
                currentFilter === 'revision_requested'
                  ? 'border-red-400 bg-red-50 ring-2 ring-red-400'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="text-[10px] font-bold text-red-700 block">再提出待ち</span>
              <span className="text-xl font-black text-red-600">{revisionCount}</span>
              <span className="text-[9px] text-red-700 block">件 (メンバー)</span>
            </button>

            <button
              onClick={() => setCurrentFilter(currentFilter === 'confirmed' ? 'all' : 'confirmed')}
              className={`p-3 rounded-2xl border text-center transition ${
                currentFilter === 'confirmed'
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="text-[10px] font-bold text-emerald-700 block">確認完了</span>
              <span className="text-xl font-black text-emerald-600">{confirmedCount}</span>
              <span className="text-[9px] text-emerald-700 block">件 (進行中)</span>
            </button>
          </div>

          {/* 表示切り替えタブ（滞り検知 ⇄ メンバー管理） */}
          <div className="flex border-b border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('stalls')}
              className={`pb-2 px-3 border-b-2 transition ${
                activeTab === 'stalls'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              滞りサイクル一覧 ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-2 px-3 border-b-2 transition ${
                activeTab === 'members'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              所属メンバー一覧 ({members.length})
            </button>
          </div>

          {/* TAB 1: 滞りサイクル一覧 */}
          {activeTab === 'stalls' && (
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">サイクルの滞りはありません</p>
                  <p className="text-xs text-slate-400">配下メンバー全員が順調に自走しています。</p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const initial = task.memberName.slice(0, 1);
                  return (
                    <div
                      key={task.planId}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2.5 transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                            {initial}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block leading-tight">
                              {task.memberName}
                            </span>
                          </div>
                        </div>

                        {task.status === 'check_pending' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
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
                        <p className="text-xs font-bold text-slate-800">{task.planTitle}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          実績: {task.rawTargetData.totalActual} {task.rawTargetData.unit} / 判定:{' '}
                          {task.rawTargetData.isAchieved ? '達成 🎉' : '未達成 ⚠️'}
                        </p>
                        {task.latestReviewComment && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                            💬 管理者コメント: {task.latestReviewComment}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedTask(task.rawTargetData)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          task.status === 'check_pending'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>提出内容をレビューする ➔</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: 所属メンバー一覧 */}
          {activeTab === 'members' && (
            <div className="space-y-2.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                      {m.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{m.name}</span>
                        {m.role === 'manager' ? (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                            管理者
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-bold">
                            メンバー
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {m.planTitle || '参加日: ' + m.joinedAt}
                      </p>
                    </div>
                  </div>

                  {m.role !== 'manager' && (
                    <button
                      onClick={() => handleDeleteMember(m.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition"
                      title="メンバー解除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* モーダル 1: チーム開設モーダル */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">👑 チームの開設</h3>
              <button onClick={() => setShowCreateTeamModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">チーム名 / 部署名</label>
                <input
                  type="text"
                  required
                  placeholder="例: 営業1課、マーケティング部"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                管理者として開設する
              </button>
            </form>
          </div>
        </div>
      )}

      {/* モーダル 2: メンバー手動追加モーダル */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">👤 メンバーの追加</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">メンバーのお名前</label>
                <input
                  type="text"
                  required
                  placeholder="例: 伊藤 健一"
                  value={memberNameInput}
                  onChange={(e) => setMemberNameInput(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">担当する目標 (Plan)</label>
                <input
                  type="text"
                  placeholder="例: 週2回の商談振り返り実施"
                  value={memberPlanInput}
                  onChange={(e) => setMemberPlanInput(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                チームメンバーに追加する
              </button>
            </form>
          </div>
        </div>
      )}

      {/* モーダル 3: 招待コード・URLモーダル */}
      {showInviteModal && org && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">🔗 メンバー招待</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              以下の招待コードまたはURLをLINEなどで共有すると、メンバーがチームに直接参加できます。
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">招待コード</span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {org.inviteCode}
                </span>
              </div>
              <button
                onClick={handleCopyInvite}
                className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copied ? '招待URLをコピーしました！' : '招待リンクをコピーする'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* レビューモーダル */}
      {selectedTask && (
        <ReviewModal
          data={selectedTask}
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  );
}
