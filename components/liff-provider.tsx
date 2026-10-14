'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Liff } from '@line/liff';
import { supabase } from '@/lib/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabase/auth';

interface LiffContextType {
  liff: Liff | null;
  liffError: string | null;
  isReady: boolean;
  user: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  forceLogin: () => Promise<void>;
}

const LiffContext = createContext<LiffContextType>({
  liff: null,
  liffError: null,
  isReady: false,
  user: null,
  forceLogin: async () => {},
});

export const useLiff = () => useContext(LiffContext);

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<LiffContextType['user']>(null);

  // 強制ログイン処理（LINEログイン + Supabaseセッション確立）
  const forceLogin = async () => {
    try {
      if (liffObject && !liffObject.isLoggedIn()) {
        liffObject.login();
        return;
      }
      await ensureSupabaseSession(user || undefined);
    } catch (e) {
      console.warn('forceLogin error:', e);
    }
  };

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        // LIFF ID未設定時はモックモードで即座にReadyにする（ローカル・Vercel初期動作対応）
        if (!liffId || liffId.includes('placeholder') || liffId.includes('YOUR_')) {
          console.warn('NEXT_PUBLIC_LIFF_ID が未設定のため、開発モックモードで動作します。');
          const mockUser = {
            userId: 'mock-user-123',
            displayName: 'テストユーザー',
          };
          setUser(mockUser);
          await ensureSupabaseSession(mockUser);
          setIsReady(true);
          return;
        }

        await liff.init({ liffId });
        setLiffObject(liff);

        // LINE未ログイン時は強制的にLINEログイン画面へ遷移
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        const currentUser = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        };
        setUser(currentUser);

        // 1. LINE IDトークンによるSupabase認証セッション連携を試行
        let sessionEstablished = false;
        const idToken = liff.getIDToken();
        if (idToken) {
          try {
            const res = await fetch('/api/auth/line', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken,
                displayName: profile.displayName,
                avatarUrl: profile.pictureUrl,
              }),
            });

            if (res.ok) {
              const { token } = await res.json();
              if (token?.access_token) {
                await supabase.auth.setSession({
                  access_token: token.access_token,
                  refresh_token: token.refresh_token,
                });
                sessionEstablished = true;
              }
            }
          } catch (apiErr) {
            console.warn('/api/auth/line fetch warning:', apiErr);
          }
        }

        // 2. もしトークン連携が未確立の場合は、直接Supabaseセッションを自動・強制ログイン
        if (!sessionEstablished) {
          await ensureSupabaseSession(currentUser);
        }

        setIsReady(true);
      } catch (err: any) {
        console.error('LIFF Init Error:', err);
        setLiffError(err.message || 'LIFF初期化に失敗しました');
        // エラー時でもSupabaseセッションを確保
        await ensureSupabaseSession();
        setIsReady(true);
      }
    };

    initLiff();
  }, []);

  return (
    <LiffContext.Provider value={{ liff: liffObject, liffError, isReady, user, forceLogin }}>
      {children}
    </LiffContext.Provider>
  );
}
