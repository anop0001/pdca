'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle2, RefreshCw, UserPlus, Sparkles, Check, AlertTriangle, MessageSquare, Trash2, Share2, Copy, ExternalLink } from 'lucide-react';
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
  const [inviteCode, setInviteCode] = useState<string>('ANOP-2026');
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'check_pending' | 'revision_requested' | 'confirmed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [reviewingTask, setReviewingTask] = useState<TeamTask | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

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
    sync(demo, 'ANOP セールスチーム', 'ANOP-2026');
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
          setTeamName(orgData.name || 'ANOP セールスチーム');
          if (orgData.invite_code) setInviteCode(orgData.invite_code);

          const { data: members } = await supabase
            .from('memberships')
            .select('id, user_id, role, member_name, created_at')
            .eq('organization_id', orgData.id);

          if (members && members.length > 0) {
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
              sync(realTasks, orgData.name || 'ANOP セールスチーム', orgData.invite_code);
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

  // LINE友だち選択（Share Target Picker）による招待
  const handleLineShare = async () => {
    setIsSharing(true);
    try {
      if (liff && liff.isLoggedIn() && liff.isApiAvailable('shareTargetPicker')) {
        const res = await liff.shareTargetPicker([
          {
            type: 'flex',
            altText: `【PDCA Check】「${teamName || 'PDCAチーム'}」への招待状`,
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#059669',
                paddingAll: '16px',
                contents: [
                  {
                    type: 'text',
                    text: 'PDCA Check チーム招待',
                    color: '#ffffff',
                    weight: 'bold',
                    size: 'sm',
                  },
                ],
              },
              body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                spacing: 'md',
                contents: [
                  {
                    type: 'text',
                    text: `「${teamName || 'ANOPチーム'}」`,
                    weight: 'bold',
                    size: 'lg',
                    wrap: true,
                    color: '#0f172a',
                  },
                  {
                    type: 'text',
                    text: 'PDCAサイクルの自走・改善チームに招待されました！下のボタンからチームに参加して、目標を共有しましょう。',
                    size: 'xs',
                    color: '#475569',
                    wrap: true,
                  },
                ],
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#059669',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: 'チームに参加する ➔',
                      uri: joinUrl,
                    },
                  },
                ],
              },
            },
          },
        ]);

        if (res) {
          showToast('🎉 LINE友だちに招待メッセージを送信しました！');
          setShowAddModal(false);
          return;
        }
      }

      // shareTargetPickerが使えないブラウザ環境等のフォールバック
      const shareText = encodeURIComponent(`【PDCA Check】「${teamName || 'PDCAチーム'}」に参加して、一緒に目標管理を始めましょう！\n\n参加はこちらから👇\n${joinUrl}`);
      window.open(`https://line.me/R/share?text=${shareText}`, '_blank');
      showToast('LINE共有画面を開きました');
    } catch (err: any) {
      console.warn('Share target picker warning:', err);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(joinUrl);
        showToast('🔗 招待URLをクリップボードにコピーしました！');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 招待URLをクリップボードにコピー
  const handleCopyInviteUrl = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(joinUrl);
      showToast('📋 招待リンクをコピーしました！LINE等で送信してください');
    }
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
          <div className="space-y-2">
            <button
              onClick={() => sync([], 'ANOP チーム', 'ANOP-2026')}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition active:scale-98"
            >
              ＋ 新しいチームを開設して管理者になる
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
                <span>{teamName}（メンバー {tasks.length}名）</span>
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
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-full">
                コード: {inviteCode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleLineShare}
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
              <span className="text-[9px] text-amber-700 block">件 (要対応)</span>
            </button>
            <button
              onClick={() => setFilter(filter === 'revision_requested' ? 'all' : 'revision_requested')}
              className={`p-3 rounded-2xl border text-center transition ${
                filter === 'revision_requested' ? 'border-red-400 bg-red-50 ring-2 ring-red-400' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-red-700 block">再提出待ち</span>
              <span className="text-xl font-black text-red-600">{revision}</span>
              <span className="text-[9px] text-red-700 block">件 (メンバー)</span>
            </button>
            <button
              onClick={() => setFilter(filter === 'confirmed' ? 'all' : 'confirmed')}
              className={`p-3 rounded-2xl border text-center transition ${
                filter === 'confirmed' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-emerald-700 block">確認完了</span>
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          修正依頼中
                        </span>
                      )}
                      {t.status === 'confirmed' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          確認完了
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

                  <button
                    onClick={() => setReviewingTask(t)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    提出内容をレビューする ➔
                  </button>
                </div>
              ))
            )}
          </div>

          {/* チーム解散・リセット */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                if (!confirm('チームを解散（全メンバーとチーム設定をリセット）しますか？\n※初期状態に戻ります。')) return;
                sync([], '', 'ANOP-2026');
                showToast('チームをリセットしました');
              }}
              className="text-xs text-slate-400 hover:text-red-500 transition"
            >
              チームを解散・リセットする
            </button>
          </div>
        </>
      )}

      {/* レビューモーダル */}
      {reviewingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3.5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">{reviewingTask.name} さんのレビュー</h3>
            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {reviewingTask.plan}
              <br />
              <span className="text-slate-400 mt-1 block">実績: {reviewingTask.actual}</span>
            </p>
            <textarea
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="フィードバックコメントを入力..."
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleReviewSubmit('confirmed')}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
              >
                ✅ 確認完了 (承認)
              </button>
              <button
                onClick={() => handleReviewSubmit('revision_requested')}
                className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-300 rounded-xl text-xs font-bold hover:bg-red-100 transition"
              >
                ⚠️ 修正依頼
              </button>
            </div>
            <button
              onClick={() => setReviewingTask(null)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 pt-1"
            >
              キャンセル
            </button>
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
