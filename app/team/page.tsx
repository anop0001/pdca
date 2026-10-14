'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle2, RefreshCw, UserPlus, Sparkles, Check, AlertTriangle, MessageSquare } from 'lucide-react';

interface TeamTask {
  id: string;
  name: string;
  plan: string;
  status: 'check_pending' | 'revision_requested' | 'confirmed';
  actual: string;
  comment?: string;
}

export default function TeamPage() {
  const [teamName, setTeamName] = useState<string>('');
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'check_pending' | 'revision_requested' | 'confirmed'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [reviewingTask, setReviewingTask] = useState<TeamTask | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const sync = (tList: TeamTask[], tName: string) => {
    setTasks(tList);
    setTeamName(tName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdca_team_info', JSON.stringify({ name: tName }));
      localStorage.setItem('pdca_team_tasks', JSON.stringify(tList));
      window.dispatchEvent(new Event('pdca_tasks_updated'));
    }
  };

  const loadDemo = useCallback(() => {
    const demo: TeamTask[] = [
      { id: '1', name: '田中 健太', plan: '新規架電アプローチ (毎日20件)', status: 'check_pending', actual: '期間合計85件 / 未達 ⚠️' },
      { id: '2', name: '佐藤 茜', plan: '商談後の即時議事録送付', status: 'revision_requested', actual: '期間内3回 / 未達 ⚠️', comment: '目標値の具体化を依頼中' },
      { id: '3', name: '山田 太郎', plan: '毎日3件の既存フォロー連絡', status: 'confirmed', actual: '期間合計21件 / 達成 🎉', comment: '素晴らしい継続力です！' },
    ];
    sync(demo, 'ANOP セールスチーム');
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedInfo = localStorage.getItem('pdca_team_info');
      const savedTasks = localStorage.getItem('pdca_team_tasks');
      if (savedInfo) setTeamName(JSON.parse(savedInfo).name || '');
      if (savedTasks) setTasks(JSON.parse(savedTasks));
    }
  }, []);

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
    setShowAdd(false);
  };

  const handleReviewSubmit = (status: 'confirmed' | 'revision_requested') => {
    if (!reviewingTask) return;
    const updated = tasks.map((t) =>
      t.id === reviewingTask.id
        ? { ...t, status, comment: reviewComment.trim() || (status === 'confirmed' ? '確認完了しました！' : '修正をお願いします') }
        : t
    );
    sync(updated, teamName);
    setReviewingTask(null);
    setReviewComment('');
  };

  const checkPending = tasks.filter((t) => t.status === 'check_pending').length;
  const revision = tasks.filter((t) => t.status === 'revision_requested').length;
  const confirmed = tasks.filter((t) => t.status === 'confirmed').length;
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-16 animate-in fade-in duration-200">
      {!teamName ? (
        <div className="p-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">👑</div>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 block uppercase">チーム管理機能</span>
              <h1 className="text-base font-extrabold text-slate-900">管理者登録 & チーム開設</h1>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            直属メンバーのPDCAサイクルの滞りをリアルタイムに検知し、レビューを行うダッシュボードです。
          </p>
          <div className="space-y-2">
            <button
              onClick={() => sync([], 'ANOP チーム')}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
            >
              ＋ 新しいチームを開設して管理者になる
            </button>
            <button
              onClick={loadDemo}
              className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ デモ用メンバー（田中・佐藤・山田）を読み込む</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{teamName}（メンバー {tasks.length}名）</span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">サイクルの滞り検知</h1>
            </div>
            <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">管理者モード</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>メンバー追加</span>
            </button>
            <button
              onClick={loadDemo}
              className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1"
              title="デモ状態を読込"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>デモ読込</span>
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAddMember} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 animate-in fade-in">
              <h3 className="text-xs font-bold text-slate-800">👤 メンバー登録</h3>
              <input
                type="text"
                required
                placeholder="メンバー氏名 (例: 伊藤 健一)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white"
              />
              <input
                type="text"
                placeholder="目標 (例: 週2回の新規アプローチ)"
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white"
              />
              <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">
                チームに追加する
              </button>
            </form>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFilter(filter === 'check_pending' ? 'all' : 'check_pending')}
              className={`p-3 rounded-2xl border text-center transition ${filter === 'check_pending' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400' : 'border-slate-200 bg-white'}`}
            >
              <span className="text-[10px] font-bold text-amber-700 block">確認待ち</span>
              <span className="text-xl font-black text-amber-600">{checkPending}</span>
              <span className="text-[9px] text-amber-700 block">件 (要対応)</span>
            </button>
            <button
              onClick={() => setFilter(filter === 'revision_requested' ? 'all' : 'revision_requested')}
              className={`p-3 rounded-2xl border text-center transition ${filter === 'revision_requested' ? 'border-red-400 bg-red-50 ring-2 ring-red-400' : 'border-slate-200 bg-white'}`}
            >
              <span className="text-[10px] font-bold text-red-700 block">再提出待ち</span>
              <span className="text-xl font-black text-red-600">{revision}</span>
              <span className="text-[9px] text-red-700 block">件 (メンバー)</span>
            </button>
            <button
              onClick={() => setFilter(filter === 'confirmed' ? 'all' : 'confirmed')}
              className={`p-3 rounded-2xl border text-center transition ${filter === 'confirmed' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400' : 'border-slate-200 bg-white'}`}
            >
              <span className="text-[10px] font-bold text-emerald-700 block">確認完了</span>
              <span className="text-xl font-black text-emerald-600">{confirmed}</span>
              <span className="text-[9px] text-emerald-700 block">件 (進行中)</span>
            </button>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">サイクルの滞りはありません</p>
                <p className="text-xs text-slate-400">配下メンバー全員が順調に自走しています。</p>
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
                    {t.status === 'check_pending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Check確認待ち</span>}
                    {t.status === 'revision_requested' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">修正依頼中</span>}
                    {t.status === 'confirmed' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">確認完了</span>}
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
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    提出内容をレビューする ➔
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {reviewingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleReviewSubmit('confirmed')}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
              >
                ✅ 確認完了 (承認)
              </button>
              <button
                onClick={() => handleReviewSubmit('revision_requested')}
                className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-300 rounded-xl text-xs font-bold hover:bg-red-100"
              >
                ⚠️ 修正依頼
              </button>
            </div>
            <button onClick={() => setReviewingTask(null)} className="w-full text-xs text-slate-400 hover:text-slate-600 pt-1">
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
