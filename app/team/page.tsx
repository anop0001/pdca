'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle2, RefreshCw, UserPlus, Sparkles, Check, AlertTriangle, MessageSquare, Trash2, Share2, Copy, ExternalLink, Pencil, X } from 'lucide-react';
import { useLiff } from '@/components/liff-provider';
import { supabase } from '@/lib/supabase/client';

interface TeamTask {
  id: string;
  name: string;
  plan: string;
  status: 'check_pending' | 'revision_requested' | 'confirmed';
  actual: string;
  comment?: string;
  userId?: string;
}

export default function TeamPage() {
  const { liff, user: liffUser } = useLiff();

  const [teamName, setTeamName] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('TEAM-2026');
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'check_pending' | 'revision_requested' | 'confirmed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [reviewingTask, setReviewingTask] = useState<TeamTask | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // チーム開設時の入力
  const [newTeamInput, setNewTeamInput] = useState('');

  // チーム情報編集モーダル
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editInviteCode, setEditInviteCode] = useState('');

  // 招待メッセージ編集・送信モーダル
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteModalTeamName, setInviteModalTeamName] = useState('');
  const [inviteModalMessage, setInviteModalMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sync = (tList: TeamTask[], tName: string, code?: string) => {
    setTasks(tList);
    setTeamName(tName);
    const finalCode = code || inviteCode;
    setInviteCode(finalCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdca_team_info', JSON.stringify({ name: tName, code: finalCode }));
      localStorage.setItem('pdca_team_tasks', JSON.stringify(tList));
      window.dispatchEvent(new Event('pdca_tasks_updated'));
    }
  };

  // デモデータの読み込み
  const loadDemo = useCallback(() => {
    const demo: TeamTask[] = [
      { id: '1', name: '田中 健太', plan: '新規架電アプローチ (毎日20件)', status: 'check_pending', actual: '期間合計85件 / 未達 ⚠️' },
      { id: '2', name: '佐藤 茜', plan: '商談後の即時議事録送付', status: 'revision_requested', actual: '期間内3回 / 未達 ⚠️', comment: '目標値の具体化を依頼中' },
      { id: '3', name: '山田 太郎', plan: '毎日3件の既存フォロー連絡', status: 'confirmed', actual: '期間合計21件 / 達成 🎉', comment: '素晴らしい継続力です！' },
    ];
    sync(demo, '営業第1チーム', 'DEMO-2026');
    showToast('⚡ デモ用メンバーデータを読み込みました');
  }, [inviteCode]);

  // 初期読み込み: Supabase実データまたはローカルキャッシュから復元
  useEffect(() => {
    async function loadTeamData() {
      // 1. ローカルキャッシュ読込
      if (typeof window !== 'undefined') {
        const savedInfo = localStorage.getItem('pdca_team_info');
        const savedTasks = localStorage.getItem('pdca_team_tasks');
        if (savedInfo) {
          try {
            const parsed = JSON.parse(savedInfo);
            setTeamName(parsed.name || '');
            if (parsed.code) setInviteCode(parsed.code);
          } catch {}
        }
        if (savedTasks) {
          try {
            setTasks(JSON.parse(savedTasks));
          } catch {}
        }
      }

      // 2. Supabaseからの実メンバー同期を試行
      try {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name, invite_code')
          .limit(1)
          .maybeSingle();

        if (orgData) {
          if (orgData.name) setTeamName(orgData.name);
          if (orgData.invite_code) setInviteCode(orgData.invite_code);

          // メンバー一覧を取得
          const { data: members } = await supabase
            .from('memberships')
            .select('id, user_id, role, member_name, created_at')
            .eq('organization_id', orgData.id);

          if (members && members.length > 0) {
            // 各メンバーのPlanと最新実績を取得
            const realTasks: TeamTask[] = [];
            for (const m of members) {
              const { data: plans } = await supabase
                .from('plans')
                .select(`
                  id,
                  title,
                  status,
                  plan_versions (
                    action_plan,
                    target_value,
                    unit
                  ),
                  do_records (
                    actual_value,
                    is_completed
                  )
                `)
                .eq('user_id', m.user_id)
                .eq('status', 'in_progress')
                .limit(1);

              const currentPlan = plans?.[0];
              const ver = currentPlan?.plan_versions?.[0];
              const record = currentPlan?.do_records?.[0];

              realTasks.push({
                id: m.id,
                userId: m.user_id,
                name: m.member_name || 'メンバー',
                plan: ver?.action_plan || currentPlan?.title || '日次業務の目標達成',
                status: record?.is_completed ? 'confirmed' : 'check_pending',
                actual: record ? `本日実績: ${record.actual_value || 0}${ver?.unit || ''}` : '初期サイクル進行中',
              });
            }

            if (realTasks.length > 0) {
              sync(realTasks, orgData.name || 'マイPDCAチーム', orgData.invite_code);
            }
          }
        }
      } catch (err) {
        console.warn('Team fetch from Supabase warning:', err);
      }
    }

    loadTeamData();
  }, []);

  // 招待URL
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${inviteCode}`
    : `https://pdca-mauve.vercel.app/join?code=${inviteCode}`;

  // 招待モーダルを開く
  const openInviteModal = () => {
    const curName = teamName || 'マイPDCAチーム';
    setInviteModalTeamName(curName);
    const msg = `【PDCA Check】「${curName}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`;
    setInviteModalMessage(msg);
    setShowInviteModal(true);
  };

  // 招待モーダル内でチーム名変更時の連動
  const handleInviteModalTeamChange = (val: string) => {
    setInviteModalTeamName(val);
    const oldName = inviteModalTeamName || teamName || 'マイPDCAチーム';
    const newName = val || 'マイPDCAチーム';
    if (inviteModalMessage.includes(oldName)) {
      setInviteModalMessage(inviteModalMessage.replaceAll(oldName, newName));
    } else {
      setInviteModalMessage(`【PDCA Check】「${newName}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`);
    }
  };

  // LINE友だち選択（Share Target Picker）による招待送信
  const handleLineShare = async (messageText?: string) => {
    setIsSharing(true);
    const textToSend = messageText || `【PDCA Check】「${teamName || 'マイPDCAチーム'}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`;

    try {
      // 1. LIFF shareTargetPicker（LINE友だち選択画面を開いて直接送信）
      if (liff && liff.isLoggedIn() && liff.isApiAvailable('shareTargetPicker')) {
        const res = await liff.shareTargetPicker([
          {
            type: 'text',
            text: textToSend,
          },
        ]);

        if (res) {
          showToast('🎉 LINE友だちに招待メッセージを送信しました！');
          setShowInviteModal(false);
          return;
        }
      }

      // 2. ブラウザ等でのフォールバック（LINE共有スキーム）
      const shareText = encodeURIComponent(textToSend);
      window.open(`https://line.me/R/share?text=${shareText}`, '_blank');
      showToast('LINE共有画面を開きました');
      setShowInviteModal(false);
    } catch (err: any) {
      console.warn('Share target picker warning:', err);
      // クリップボードにコピー
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToSend);
        showToast('🔗 招待メッセージをクリップボードにコピーしました！');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 招待モーダルからの送信ハンドラ
  const handleSendInviteFromModal = async () => {
    const trimmedName = inviteModalTeamName.trim();
    if (trimmedName && trimmedName !== teamName) {
      sync(tasks, trimmedName, inviteCode);
      try {
        const { data: orgData } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
        if (orgData) {
          await supabase.from('organizations').update({ name: trimmedName }).eq('id', orgData.id);
        }
      } catch {}
    }
    await handleLineShare(inviteModalMessage);
  };

  // 招待モーダル内のメッセージをコピー
  const handleCopyInviteMessage = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(inviteModalMessage);
      showToast('📋 招待メッセージをコピーしました！');
    }
  };

  // 招待URLをクリップボードにコピー
  const handleCopyInviteUrl = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(joinUrl);
      showToast('📋 招待リンクをコピーしました！LINE等で送信してください');
    }
  };

  // チーム情報編集モーダルを開く
  const openEditTeamModal = () => {
    setEditTeamName(teamName);
    setEditInviteCode(inviteCode);
    setShowEditTeamModal(true);
  };

  // チーム情報の更新保存
  const handleSaveTeamEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = editTeamName.trim() || 'マイPDCAチーム';
    const finalCode = editInviteCode.trim() || inviteCode;
    sync(tasks, finalName, finalCode);
    setShowEditTeamModal(false);
    showToast(`チーム情報を更新しました（${finalName}）`);

    try {
      const { data: orgData } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
      if (orgData) {
        await supabase.from('organizations').update({ name: finalName, invite_code: finalCode }).eq('id', orgData.id);
      }
    } catch (err) {
      console.warn('Supabase org update warning:', err);
    }
  };

  // 手動でメンバー追加（デモ用）
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newTask: TeamTask = {
      id: String(Date.now()),
      name: newName.trim(),
      plan: newPlan.trim() || '日次業務の目標達成',
      status: 'check_pending',
      actual: '初期サイクル進行中',
    };
    sync([newTask, ...tasks], teamName || 'マイPDCAチーム');
    setNewName('');
    setNewPlan('');
    setShowAddModal(false);
    showToast(`👤 ${newName.trim()} さんを追加しました`);
  };

  // メンバーの削除（除名）
  const handleDeleteTeamTask = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    const name = target?.name || 'このメンバー';
    if (!confirm(`「${name}」さんをチームから除名（メンバー削除）しますか？\n※この操作は取り消せません。`)) return;

    try {
      if (target?.userId) {
        await supabase.from('memberships').delete().eq('user_id', target.userId);
      } else {
        await supabase.from('memberships').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Membership delete warning:', err);
    }

    const updated = tasks.filter((t) => t.id !== id);
    sync(updated, teamName);
    showToast(`🗑️ ${name} さんをチームから除名しました`);
  };

  // レビュー送信
  const handleReviewSubmit = async (status: 'confirmed' | 'revision_requested') => {
    if (!reviewingTask) return;
    const comment = reviewComment.trim() || (status === 'confirmed' ? '確認完了しました！この調子で進めてください。' : '目標・行動の修正をお願いします。');

    // Supabaseへのレビュー保存試行
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('reviews').insert({
        plan_id: reviewingTask.id,
        reviewer_id: user?.id || '00000000-0000-0000-0000-000000000001',
        status,
        comment,
      });
    } catch (err) {
      console.warn('Review save warning:', err);
    }

    const updated = tasks.map((t) =>
      t.id === reviewingTask.id ? { ...t, status, comment } : t
    );
    sync(updated, teamName);
    setReviewingTask(null);
    setReviewComment('');
    showToast(status === 'confirmed' ? '✅ レビュー（確認完了）を送信しました' : '⚠️ 修正依頼を送信しました');
  };

  const checkPending = tasks.filter((t) => t.status === 'check_pending').length;
  const revision = tasks.filter((t) => t.status === 'revision_requested').length;
  const confirmed = tasks.filter((t) => t.status === 'confirmed').length;
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-16 animate-in fade-in duration-200">
      {!teamName ? (
        <div className="p-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">👑</div>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 block uppercase">チーム管理機能</span>
              <h1 className="text-base font-extrabold text-slate-900">管理者登録 & チーム開設</h1>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            直属メンバーのPDCAサイクルの滞り（未達・評価遅れ）をリアルタイムに検知し、レビューやアドバイスを行うダッシュボードです。
          </p>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">開設するチーム名</label>
              <input
                type="text"
                placeholder="例: 営業第一チーム、マイプロジェクト"
                value={newTeamInput}
                onChange={(e) => setNewTeamInput(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
            <button
              onClick={() => {
                const finalName = newTeamInput.trim() || 'マイPDCAチーム';
                sync([], finalName, 'TEAM-' + Math.floor(1000 + Math.random() * 9000));
                showToast(`🎉 チーム「${finalName}」を開設しました`);
              }}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition active:scale-98"
            >
              ＋ チームを開設して管理者になる
            </button>
            <button
              onClick={loadDemo}
              className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 flex items-center justify-center gap-1 shadow-sm transition active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ デモ用メンバー（田中・佐藤・山田）を読み込む</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ヘッダー情報 */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-900">{teamName}</span>
                <button
                  type="button"
                  onClick={openEditTeamModal}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition"
                  title="チーム名を変更"
                >
                  <Pencil className="w-3 h-3 text-emerald-600" />
                  <span>変更</span>
                </button>
                <span>（{tasks.length}名）</span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">サイクルの滞り検知</h1>
            </div>
            <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
              管理者モード
            </span>
          </div>

          {/* メンバー招待 & 追加バー */}
          <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                <Users className="w-4 h-4 text-emerald-600" />
                メンバー
