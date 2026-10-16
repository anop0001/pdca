'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLiff } from '@/components/liff-provider';
import { getCurrentUserId } from '@/lib/supabase/auth';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const { user: liffUser } = useLiff();

  const [name, setName] = useState(liffUser?.displayName || '');
  const [code, setCode] = useState(initialCode);
  const [teamName, setTeamName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // LINEプロファイル情報があれば自動入力
  useEffect(() => {
    if (liffUser?.displayName && !name) {
      setName(liffUser.displayName);
    }
  }, [liffUser, name]);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      lookupTeam(initialCode);
    }
  }, [initialCode]);

  // 招待コードからチーム名を逆引き
  const lookupTeam = async (targetCode: string) => {
    if (!targetCode.trim()) return;
    try {
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('invite_code', targetCode.trim())
        .maybeSingle();

      if (data?.name) {
        setTeamName(data.name);
      }
    } catch {}
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = await getCurrentUserId(liffUser || undefined);
      const userId = currentUserId || user?.id || '00000000-0000-0000-0000-000000000002';

      // 1. Supabaseの該当チームにメンバー登録
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('invite_code', code.trim())
        .maybeSingle();

      if (orgData) {
        await supabase.from('memberships').upsert({
          organization_id: orgData.id,
          user_id: userId,
          role: 'member',
          member_name: name.trim(),
        });
      }

      // 2. ローカルキャッシュにも保存
      if (typeof window !== 'undefined') {
        const memberObj = {
          id: 'm-' + Date.now(),
          name: name.trim(),
          role: 'member',
          joinedAt: new Date().toISOString().split('T')[0],
        };
        const cachedMembers = localStorage.getItem('pdca_team_members');
        const membersList = cachedMembers ? JSON.parse(cachedMembers) : [];
        membersList.push(memberObj);
        localStorage.setItem('pdca_team_members', JSON.stringify(membersList));
        localStorage.setItem('pdca_user_name', name.trim());
        localStorage.setItem('pdca_current_team_code', code.trim());
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.warn('Join warning:', err);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">チームに参加する</h1>
        <p className="text-xs text-slate-500">
          {teamName ? `「${teamName}」への招待状が届いています。` : '招待コードとお名前を確認して、チームのPDCAサイクル管理に参加しましょう。'}
        </p>
      </div>

      {success ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-2 animate-in zoom-in duration-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h2 className="text-base font-bold text-emerald-900">チームに参加しました！</h2>
          <p className="text-xs text-emerald-700">ホーム画面へ移動しています...</p>
        </div>
      ) : (
        <form onSubmit={handleJoin} className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4">
          {teamName && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-emerald-700 block uppercase">参加予定チーム</span>
              <span className="text-sm font-extrabold text-emerald-950">{teamName}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">あなたのお名前 (LINE表示名)</label>
            <input
              type="text"
              required
              placeholder="例: 佐藤 茜"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">招待コード</label>
            <input
              type="text"
              required
              placeholder="例: TEAM-2026"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                lookupTeam(e.target.value);
              }}
              className="w-full p-3 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? '参加処理中...' : 'チームに参加して始める'}</span>
          </button>
        </form>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">読み込み中...</div>}>
      <JoinContent />
    </Suspense>
  );
}
