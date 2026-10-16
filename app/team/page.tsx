'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle2, RefreshCw, UserPlus, Sparkles, Check, AlertTriangle, MessageSquare, Trash2, Share2, Copy, ExternalLink, Pencil, X } from 'lucide-react';
import { useLiff } from '@/components/liff-provider';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';

interface TeamTask {
  id: string;
  name: string;
  plan: string;
  status: 'check_pending' | 'revision_requested' | 'confirmed';
  actual: string;
  comment?: string;
  userId?: string;
  planId?: string;
}

export default function TeamPage() {
  const { liff, user: liffUser, isReady } = useLiff();

  const [orgId, setOrgId] = useState<string | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);

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

  // LINEリマインド送信モーダル（完全無料・通数制限なし）
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTargetName, setReminderTargetName] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');

  // アカウント名（LINE表示名、またはローカル保存されているユーザー名）を取得
  const getAccountName = useCallback(() => {
    if (liffUser?.displayName) return liffUser.displayName;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdca_user_name');
      if (saved) return saved;
    }
    return '';
  }, [liffUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sync = (tList: TeamTask[], tName: string, code?: string, newOrgId?: string | null) => {
    setTasks(tList);
    setTeamName(tName);
    const finalCode = code || inviteCode;
    setInviteCode(finalCode);
    const finalOrgId = newOrgId !== undefined ? newOrgId : orgId;
    if (newOrgId !== undefined) {
      setOrgId(newOrgId);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdca_team_info', JSON.stringify({ name: tName, code: finalCode, orgId: finalOrgId }));
      localStorage.setItem('pdca_team_tasks', JSON.stringify(tList));
      window.dispatchEvent(new Event('pdca_tasks_updated'));
    }
  };

  // LINEユーザー情報が取得できた際、過去のデフォルト(ANOP)の修正や初期設定
  useEffect(() => {
    if (liffUser?.displayName) {
      const autoTeamName = `${liffUser.displayName}チーム`;

      setTeamName((prev) => {
        if (!prev || prev.includes('ANOP') || prev === 'マイPDCAチーム' || prev === 'マイチーム') {
          if (typeof window !== 'undefined') {
            const savedInfo = localStorage.getItem('pdca_team_info');
            const parsed = savedInfo ? JSON.parse(savedInfo) : {};
            parsed.name = autoTeamName;
            localStorage.setItem('pdca_team_info', JSON.stringify(parsed));
          }
          return autoTeamName;
        }
        return prev;
      });

      setNewTeamInput((prev) => (!prev || prev.includes('ANOP') ? autoTeamName : prev));
    }
  }, [liffUser]);

  // デモデータの読み込み
  const loadDemo = useCallback(() => {
    const acc = getAccountName();
    const curName = acc ? `${acc}チーム` : '営業第1チーム';
    const demo: TeamTask[] = [
      { id: '1', name: '田中 健太', plan: '新規架電アプローチ (毎日20件)', status: 'check_pending', actual: '期間合計85件 / 未達 ⚠️' },
      { id: '2', name: '佐藤 茜', plan: '商談後の即時議事録送付', status: 'revision_requested', actual: '期間内3回 / 未達 ⚠️', comment: '目標値の具体化を依頼中' },
      { id: '3', name: '山田 太郎', plan: '毎日3件の既存フォロー連絡', status: 'confirmed', actual: '期間合計21件 / 達成 🎉', comment: '素晴らしい継続力です！' },
    ];
    sync(demo, curName, inviteCode || 'DEMO-2026', orgId);
    showToast('⚡ デモ用メンバーデータを読み込みました');
  }, [inviteCode, orgId, getAccountName]);

  // 初期読み込み: ユーザー個別の所属・管理組織を取得（マルチテナント分離）
  const loadTeamData = useCallback(async () => {
    setIsLoading(true);
    const acc = getAccountName();
    const defaultName = acc ? `${acc}チーム` : 'マイチーム';
    let cachedOrgId: string | null = null;
    let cachedInviteCode = 'TEAM-2026';

    // 1. ローカルキャッシュ読込
    if (typeof window !== 'undefined') {
      const savedInfo = localStorage.getItem('pdca_team_info');
      const savedTasks = localStorage.getItem('pdca_team_tasks');
      if (savedInfo) {
        try {
          const parsed = JSON.parse(savedInfo);
          const savedName = parsed.name || '';
          if (savedName && !savedName.includes('ANOP')) {
            setTeamName(savedName);
          } else {
            setTeamName(defaultName);
          }
          if (parsed.code) {
            setInviteCode(parsed.code);
            cachedInviteCode = parsed.code;
          }
          if (parsed.orgId) {
            cachedOrgId = parsed.orgId;
            setOrgId(parsed.orgId);
          }
        } catch {}
      }
      if (savedTasks) {
        try {
          setTasks(JSON.parse(savedTasks));
        } catch {}
      }
    }

    // 2. ログインユーザーのSupabaseセッション/UUID特定
    try {
      const currentUserId = await getCurrentUserId(liffUser || undefined);
      let matchedOrg: { id: string; name: string; invite_code: string } | null = null;

      if (currentUserId) {
        // 2-a. membershipsテーブルから自身の所属組織を検索
        const { data: userMemberships } = await supabase
          .from('memberships')
          .select('organization_id, role, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false });

        if (userMemberships && userMemberships.length > 0) {
          const primaryMembership = userMemberships.find((m: any) => m.role === 'admin') || userMemberships[0];
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id, name, invite_code')
            .eq('id', primaryMembership.organization_id)
            .maybeSingle();

          if (orgData) {
            matchedOrg = orgData;
          }
        }
      }

      // 2-b. membershipで見つからない場合、ローカル招待コードで組織を検索
      if (!matchedOrg && cachedInviteCode && cachedInviteCode !== 'TEAM-2026') {
        const { data: orgByCode } = await supabase
          .from('organizations')
          .select('id, name, invite_code')
          .eq('invite_code', cachedInviteCode)
          .maybeSingle();

        if (orgByCode) {
          matchedOrg = orgByCode;
          if (currentUserId) {
            await supabase.from('memberships').upsert({
              organization_id: orgByCode.id,
              user_id: currentUserId,
              role: 'admin',
              member_name: acc || '管理者',
            });
          }
        }
      }

      // 2-c. キャッシュのorgIdで検索
      if (!matchedOrg && cachedOrgId) {
        const { data: orgById } = await supabase
          .from('organizations')
          .select('id, name, invite_code')
          .eq('id', cachedOrgId)
          .maybeSingle();

        if (orgById) {
          matchedOrg = orgById;
        }
      }

      // 組織が見つかった場合、メンバーとタスクを同期
      if (matchedOrg) {
        setOrgId(matchedOrg.id);
        const cleanName = matchedOrg.name && !matchedOrg.name.includes('ANOP') ? matchedOrg.name : defaultName;
        setTeamName(cleanName);
        if (matchedOrg.invite_code) setInviteCode(matchedOrg.invite_code);

        // メンバー一覧を取得
        const { data: members } = await supabase
          .from('memberships')
          .select('id, user_id, role, member_name, created_at')
          .eq('organization_id', matchedOrg.id);

        if (members && members.length > 0) {
          // 各メンバーの最新Planと実績を取得
          const realTasks: TeamTask[] = [];
          for (const m of members) {
            const { data: plans } = await supabase
              .from('plans')
              .select(`
                id,
                title,
                status,
                plan_versions (
                  id,
                  action_plan,
                  target_value,
                  unit
                ),
                do_records (
                  id,
                  actual_value,
                  is_completed
                ),
                reviews (
                  id,
                  status,
                  comment,
                  created_at
                )
              `)
              .eq('user_id', m.user_id)
              .eq('status', 'in_progress')
              .order('created_at', { ascending: false })
              .limit(1);

            const currentPlan = plans?.[0];
            const ver = currentPlan?.plan_versions?.[0];
            const record = currentPlan?.do_records?.[0];
            const latestReview = (currentPlan?.reviews || []).sort(
              (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            let taskStatus: 'check_pending' | 'revision_requested' | 'confirmed' = 'check_pending';
            if (latestReview?.status === 'confirmed') {
              taskStatus = 'confirmed';
            } else if (latestReview?.status === 'revision_requested') {
              taskStatus = 'revision_requested';
            } else if (record?.is_completed) {
              taskStatus = 'confirmed';
            }

            realTasks.push({
              id: currentPlan?.id || m.id,
              planId: currentPlan?.id,
              userId: m.user_id,
              name: m.member_name || 'メンバー',
              plan: ver?.action_plan || currentPlan?.title || '日次業務の目標達成',
              status: taskStatus,
              actual: record ? `本日実績: ${record.actual_value ?? 0}${ver?.unit || ''}` : '初期サイクル進行中',
              comment: latestReview?.comment || undefined,
            });
          }

          if (realTasks.length > 0) {
            sync(realTasks, cleanName, matchedOrg.invite_code, matchedOrg.id);
          }
        }
      }
    } catch (err) {
      console.warn('Team fetch from Supabase warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAccountName, liffUser]);

  useEffect(() => {
    if (!isReady) return;
    loadTeamData();
  }, [isReady, loadTeamData]);

  // 招待URL
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${inviteCode}`
    : `https://pdca-mauve.vercel.app/join?code=${inviteCode}`;

  // 招待モーダルを開く
  const openInviteModal = () => {
    const acc = getAccountName();
    const curName = teamName || (acc ? `${acc}チーム` : 'マイチーム');
    setInviteModalTeamName(curName);
    const msg = `【PDCA Check】「${curName}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`;
    setInviteModalMessage(msg);
    setShowInviteModal(true);
  };

  // 招待モーダル内でチーム名変更時の連動
  const handleInviteModalTeamChange = (val: string) => {
    setInviteModalTeamName(val);
    const acc = getAccountName();
    const oldName = inviteModalTeamName || teamName || (acc ? `${acc}チーム` : 'マイチーム');
    const newName = val || (acc ? `${acc}チーム` : 'マイチーム');
    if (inviteModalMessage.includes(oldName)) {
      setInviteModalMessage(inviteModalMessage.replaceAll(oldName, newName));
    } else {
      setInviteModalMessage(`【PDCA Check】「${newName}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`);
    }
  };

  // LINE友だち選択（Share Target Picker）による招待送信
  const handleLineShare = async (messageText?: string) => {
    setIsSharing(true);
    const acc = getAccountName();
    const displayTeam = teamName || (acc ? `${acc}チーム` : 'マイチーム');
    const textToSend = messageText || `【PDCA Check】「${displayTeam}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`;

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

  // チーム開設（Supabaseにorganizationsおよび管理者membershipsを永続化）
  const handleCreateTeam = async () => {
    const acc = getAccountName();
    const finalName = newTeamInput.trim() || (acc ? `${acc}チーム` : 'マイチーム');
    const generatedCode = 'TEAM-' + Math.floor(1000 + Math.random() * 9000);

    let createdOrgId: string | null = null;
    try {
      const currentUserId = await getCurrentUserId(liffUser || undefined);

      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({
          name: finalName,
          invite_code: generatedCode,
        })
        .select('id, name, invite_code')
        .single();

      if (newOrg) {
        createdOrgId = newOrg.id;
        setOrgId(newOrg.id);

        if (currentUserId) {
          await supabase.from('memberships').upsert({
            organization_id: newOrg.id,
            user_id: currentUserId,
            role: 'admin',
            member_name: acc || '管理者',
          });
        }
      }
    } catch (err) {
      console.warn('Create organization warning:', err);
    }

    sync([], finalName, generatedCode, createdOrgId);
    showToast(`🎉 チーム「${finalName}」を開設しました`);
  };

  // 招待モーダルからの送信ハンドラ
  const handleSendInviteFromModal = async () => {
    const trimmedName = inviteModalTeamName.trim();
    if (trimmedName && trimmedName !== teamName) {
      sync(tasks, trimmedName, inviteCode, orgId);
      try {
        if (orgId) {
          await supabase.from('organizations').update({ name: trimmedName }).eq('id', orgId);
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

  // リマインド送信モーダルを開く（空ならチーム全体、指定あれば対象メンバー宛て）
  const openReminderModal = (targetMember?: TeamTask) => {
    const acc = getAccountName();
    const displayTeam = teamName || (acc ? `${acc}チーム` : 'マイチーム');
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pdca-mauve.vercel.app/';

    if (targetMember) {
      setReminderTargetName(targetMember.name);
      setReminderMessage(
        `【PDCAリマインド】${targetMember.name} さん🎯\n「${targetMember.plan}」の振り返り評価の期日です！\n\n今週の実績を記録して、次の一手を登録しましょう！\n\n▼PDCAアプリを開く👇\n${appUrl}`
      );
    } else {
      setReminderTargetName('');
      setReminderMessage(
        `【PDCAリマインド】「${displayTeam}」のみなさん🎯\n今週のPDCA振り返り・評価の締め切りが近づいています！\n\n今週の成果を振り返り、次のActionを確定しましょう！\n\n▼PDCAアプリを開いて確認・記録👇\n${appUrl}`
      );
    }
    setShowReminderModal(true);
  };

  // リマインドメッセージをLINE送信
  const handleSendReminder = async () => {
    await handleLineShare(reminderMessage);
    setShowReminderModal(false);
  };

  // リマインドメッセージをクリップボードにコピー
  const handleCopyReminderMessage = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(reminderMessage);
      showToast('📋 リマインドメッセージをコピーしました！');
    }
  };

  // チーム情報編集モーダルを開く
  const openEditTeamModal = () => {
    const acc = getAccountName();
    setEditTeamName(teamName || (acc ? `${acc}チーム` : 'マイチーム'));
    setEditInviteCode(inviteCode);
    setShowEditTeamModal(true);
  };

  // チーム情報の更新保存
  const handleSaveTeamEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const acc = getAccountName();
    const finalName = editTeamName.trim() || (acc ? `${acc}チーム` : 'マイチーム');
    const finalCode = editInviteCode.trim() || inviteCode;
    sync(tasks, finalName, finalCode, orgId);
    setShowEditTeamModal(false);
    showToast(`チーム情報を更新しました（${finalName}）`);

    try {
      if (orgId) {
        await supabase.from('organizations').update({ name: finalName, invite_code: finalCode }).eq('id', orgId);
      } else {
        const currentUserId = await getCurrentUserId(liffUser || undefined);
        const { data: newOrg } = await supabase
          .from('organizations')
          .insert({ name: finalName, invite_code: finalCode })
          .select('id')
          .single();
        if (newOrg) {
          setOrgId(newOrg.id);
          if (currentUserId) {
            await supabase.from('memberships').upsert({
              organization_id: newOrg.id,
              user_id: currentUserId,
              role: 'admin',
              member_name: acc || '管理者',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Supabase org update warning:', err);
    }
  };

  // 手動でメンバー追加（デモ用）
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const acc = getAccountName();
    const newTask: TeamTask = {
      id: String(Date.now()),
      name: newName.trim(),
      plan: newPlan.trim() || '日次業務の目標達成',
      status: 'check_pending',
      actual: '初期サイクル進行中',
    };
    sync([newTask, ...tasks], teamName || (acc ? `${acc}チーム` : 'マイチーム'), inviteCode, orgId);
    setNewName('');
    setNewPlan('');
    setShowAddModal(false);
    showToast(`👤 ${newName.trim()} さんを追加しました`);
  };

  // メンバーの削除（除名・自チーム所属のみ安全に解除）
  const handleDeleteTeamTask = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    const name = target?.name || 'このメンバー';
    if (!confirm(`「${name}」さんをチームから除名（メンバー削除）しますか？\n※この操作は取り消せません。`)) return;

    try {
      if (orgId && target?.userId) {
        await supabase
          .from('memberships')
          .delete()
          .eq('organization_id', orgId)
          .eq('user_id', target.userId);
      } else if (orgId) {
        await supabase
          .from('memberships')
          .delete()
          .eq('organization_id', orgId)
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Membership delete warning:', err);
    }

    const updated = tasks.filter((t) => t.id !== id);
    sync(updated, teamName, inviteCode, orgId);
    showToast(`🗑️ ${name} さんをチームから除名しました`);
  };

  // チームの解散・リセット
  const handleResetTeam = async () => {
    if (!confirm('チームを解散（全メンバーとチーム設定をリセット）しますか？\n※初期状態に戻ります。')) return;
    try {
      if (orgId) {
        const currentUserId = await getCurrentUserId(liffUser || undefined);
        if (currentUserId) {
          await supabase
            .from('memberships')
            .delete()
            .eq('organization_id', orgId)
            .eq('user_id', currentUserId);
        }
      }
    } catch (err) {
      console.warn('Reset team warning:', err);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('pdca_team_info');
      localStorage.removeItem('pdca_team_tasks');
      localStorage.removeItem('pdca_team_members');
      localStorage.removeItem('pdca_current_team_code');
    }
    setOrgId(null);
    setTeamName('');
    setInviteCode('TEAM-2026');
    setTasks([]);
    showToast('チームをリセットしました');
  };

  // レビュー送信（確認のみ・アドバイス）
  const handleReviewSubmit = async (status: 'confirmed' | 'revision_requested') => {
    if (!reviewingTask) return;
    const comment = reviewComment.trim() || (status === 'confirmed' ? '確認しました！この調子で自走を続けてください。' : 'ナイスチャレンジ！次のアクションのヒントや気づきを参考に、次のサイクルを進めてみてください。');

    // Supabaseへのレビュー保存試行
    try {
      const currentUserId = await getCurrentUserId(liffUser || undefined);
      const reviewerId = currentUserId || '00000000-0000-0000-0000-000000000001';
      const targetPlanId = reviewingTask.planId || reviewingTask.id;

      await supabase.from('reviews').insert({
        plan_id: targetPlanId,
        reviewer_id: reviewerId,
        status,
        comment,
      });
    } catch (err) {
      console.warn('Review save warning:', err);
    }

    const updated = tasks.map((t) =>
      t.id === reviewingTask.id ? { ...t, status, comment } : t
    );
    sync(updated, teamName, inviteCode, orgId);
    setReviewingTask(null);
    setReviewComment('');
    showToast(status === 'confirmed' ? '✅ 確認を送信しました' : '💡 アドバイスを送信しました');
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
              <label className="text-xs font-bold text-slate-700 block mb-1">
                開設するチーム名 {getAccountName() && <span className="text-emerald-600 font-normal">（デフォルト: {getAccountName()}チーム）</span>}
              </label>
              <input
                type="text"
                placeholder={getAccountName() ? `${getAccountName()}チーム` : '例: 〇〇チーム'}
                value={newTeamInput}
                onChange={(e) => setNewTeamInput(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
            <button
              onClick={handleCreateTeam}
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
                メンバーの追加・招待
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-full">
                  コード: {inviteCode}
                </span>
                <button
                  type="button"
                  onClick={openEditTeamModal}
                  className="text-[10px] text-emerald-700 hover:text-emerald-900 underline font-medium"
                >
                  設定
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openInviteModal}
                disabled={isSharing}
                className="py-2.5 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-98"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>LINE友だちを追加</span>
              </button>

              <button
                type="button"
                onClick={handleCopyInviteUrl}
                className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>招待リンクをコピー</span>
              </button>
            </div>

            {/* チーム全体へのLINEリマインド送信ボタン（完全無料） */}
            <button
              type="button"
              onClick={() => openReminderModal()}
              disabled={isSharing}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
            >
              <Share2 className="w-4 h-4 text-emerald-100" />
              <span>📢 チームにLINEで締め切りリマインドを送信</span>
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-semibold">無料</span>
            </button>
          </div>

          {/* フィルタータブ */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFilter(filter === 'check_pending' ? 'all' : 'check_pending')}
              className={`p-3 rounded-2xl border text-center transition ${
                filter === 'check_pending' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-amber-700 block">確認待ち</span>
              <span className="text-xl font-black text-amber-600">{checkPending}</span>
              <span className="text-[9px] text-amber-700 block">件 (要確認)</span>
            </button>
            <button
              onClick={() => setFilter(filter === 'revision_requested' ? 'all' : 'revision_requested')}
              className={`p-3 rounded-2xl border text-center transition ${
                filter === 'revision_requested' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-amber-800 block">アドバイス</span>
              <span className="text-xl font-black text-amber-700">{revision}</span>
              <span className="text-[9px] text-amber-800 block">件 (ヒント共有)</span>
            </button>
            <button
              onClick={() => setFilter(filter === 'confirmed' ? 'all' : 'confirmed')}
              className={`p-3 rounded-2xl border text-center transition ${
                filter === 'confirmed' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-emerald-700 block">確認済み</span>
              <span className="text-xl font-black text-emerald-600">{confirmed}</span>
              <span className="text-[9px] text-emerald-700 block">件 (順調自走)</span>
            </button>
          </div>

          {/* メンバーリスト */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  {tasks.length === 0 ? 'まだメンバーがいません' : 'サイクルの滞りはありません'}
                </p>
                <p className="text-xs text-slate-500">
                  {tasks.length === 0
                    ? '上の「LINE友だちを追加」ボタンから友だちを招待してください。'
                    : '配下メンバー全員が順調に自走しています。'}
                </p>
                {tasks.length === 0 && (
                  <button
                    onClick={loadDemo}
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>デモ用メンバーで試す</span>
                  </button>
                )}
              </div>
            ) : (
              filtered.map((t) => (
                <div key={t.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                        {t.name.slice(0, 1)}
                      </div>
                      <span className="text-xs font-bold text-slate-900">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {t.status === 'check_pending' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Check確認待ち
                        </span>
                      )}
                      {t.status === 'revision_requested' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          💡 アドバイスあり
                        </span>
                      )}
                      {t.status === 'confirmed' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✅ 確認済み
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteTeamTask(t.id)}
                        className="px-2 py-0.5 text-[11px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 transition active:scale-95"
                        title="メンバーを除名"
                        aria-label="除名"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                        <span>除名</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">{t.plan}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">実績: {t.actual}</p>
                    {t.comment && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                        💬 コメント: {t.comment}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openReminderModal(t)}
                      className="py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 shrink-0"
                      title="このメンバーにLINEでリマインド送信"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>LINEリマインド</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewingTask(t)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                    >
                      提出内容をレビューする ➔
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* チーム解散・リセット */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleResetTeam}
              className="text-xs text-slate-400 hover:text-red-500 transition"
            >
              チームを解散・リセットする
            </button>
          </div>
        </>
      )}

      {/* LINE招待メッセージ編集・送信モーダル */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#06C755] text-white flex items-center justify-center font-bold text-xs">
                  LINE
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">LINE友だちを招待</h3>
                  <p className="text-[10px] text-slate-500">送信メッセージを自由に編集できます</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  チーム名（変更可能）
                </label>
                <input
                  type="text"
                  value={inviteModalTeamName}
                  onChange={(e) => handleInviteModalTeamChange(e.target.value)}
                  placeholder="例: 営業第一チーム"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#06C755] bg-slate-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    送信メッセージ本文（直接編集できます）
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const acc = getAccountName();
                      const curName = inviteModalTeamName || teamName || (acc ? `${acc}チーム` : 'マイチーム');
                      setInviteModalMessage(`【PDCA Check】「${curName}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`);
                    }}
                    className="text-[10px] text-emerald-600 hover:underline"
                  >
                    初期文面に戻す
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={inviteModalMessage}
                  onChange={(e) => setInviteModalMessage(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#06C755] font-sans"
                  placeholder="メッセージを入力..."
                />
              </div>

              {/* LINE風プレビュー */}
              <div className="bg-slate-100 p-3 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block">LINEメッセージ表示プレビュー:</span>
                <div className="bg-[#85E249]/20 border border-[#85E249]/40 p-2.5 rounded-2xl rounded-tl-sm text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {inviteModalMessage}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendInviteFromModal}
                disabled={isSharing}
                className="w-full py-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
              >
                <Share2 className="w-4 h-4" />
                <span>{isSharing ? '送信準備中...' : 'LINEの友だちを選択して送信'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyInviteMessage}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>このメッセージをコピー</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* チーム名編集モーダル */}
      {showEditTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form onSubmit={handleSaveTeamEdit} className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">チーム情報の編集</h3>
              <button
                type="button"
                onClick={() => setShowEditTeamModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">チーム名</label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  placeholder={getAccountName() ? `${getAccountName()}チーム` : '例: 営業第一チーム'}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">招待コード</label>
                <input
                  type="text"
                  required
                  value={editInviteCode}
                  onChange={(e) => setEditInviteCode(e.target.value)}
                  placeholder="例: TEAM-2026"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
              >
                保存する
              </button>
              <button
                type="button"
                onClick={() => setShowEditTeamModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* レビューモーダル */}
      {reviewingTask && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3.5 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{reviewingTask.name} さんのレビュー</h3>
                <p className="text-[10px] text-slate-400">自走を促すフィードバック</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingTask(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {reviewingTask.plan}
              <br />
              <span className="text-slate-400 mt-1 block">実績: {reviewingTask.actual}</span>
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                フィードバック・アドバイス（任意）
              </label>
              <textarea
                rows={2}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="自走を促すアドバイスや応援コメントを入力..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleReviewSubmit('confirmed')}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 active:scale-95 transition shadow-sm text-center"
              >
                ✅ 確認のみ
              </button>
              <button
                type="button"
                onClick={() => handleReviewSubmit('revision_requested')}
                className="flex-1 py-3 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 active:scale-95 transition shadow-xs text-center"
              >
                💡 アドバイス
              </button>
            </div>

            <button
              type="button"
              onClick={() => setReviewingTask(null)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 pt-0.5"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* LINEリマインド送信モーダル（完全無料・通数制限なし） */}
      {showReminderModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3.5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {reminderTargetName ? `${reminderTargetName} さんへのリマインド` : 'チームへの締め切りリマインド'}
                  </h3>
                  <p className="text-[10px] text-slate-500">LINE友だち・グループに無料送信</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                送信メッセージ内容（直接編集可能）
              </label>
              <textarea
                rows={5}
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans bg-slate-50"
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={isSharing}
                className="w-full py-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-98 transition disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>LINEで友だち・グループを選択して送信</span>
              </button>

              <button
                type="button"
                onClick={handleCopyReminderMessage}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>メッセージをコピー</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 text-center">
              ※LINE公式メッセージ通数を消費せず、何通でも完全無料でリマインドできます。
            </p>
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
