'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Liff } from '@line/liff';
import { supabase } from '@/lib/supabase/client';

interface LiffContextType {
  liff: Liff | null;
  liffError: string | null;
  isReady: boolean;
  user: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
}

const LiffContext = createContext<LiffContextType>({
  liff: null,
  liffError: null,
  isReady: false,
  user: null,
});

export const useLiff = () => useContext(LiffContext);

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<LiffContextType['user']>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        // LIFF ID未設定時はモックモードで即座にReadyにする（ローカル・Vercel初期動作対応）
        if (!liffId || liffId.includes('placeholder') || liffId.includes('YOUR_')) {
          console.warn('NEXT_PUBLIC_LIFF_ID が未設定のため、開発モックモードで動作します。');
          setUser({
            userId: 'mock-user-123',
            displayName: 'テストユーザー',
          });
          setIsReady(true);
          return;
        }

        await liff.init({ liffId });
        setLiffObject(liff);

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setUser({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        });

        const idToken = liff.getIDToken();
        if (idToken) {
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
            }
          }
        }

        setIsReady(true);
      } catch (err: any) {
        console.error('LIFF Init Error:', err);
        setLiffError(err.message || 'LIFF初期化に失敗しました');
        // エラー時もアプリ全体が止まらないようReadyにする
        setIsReady(true);
      }
    };

    initLiff();
  }, []);

  return (
    <LiffContext.Provider value={{ liff: liffObject, liffError, isReady, user }}>
      {children}
    </LiffContext.Provider>
  );
}
