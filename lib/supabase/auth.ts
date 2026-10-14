import { supabase } from '@/lib/supabase/client';

/**
 * セッション未確立時に自動的・強制的にSupabaseセッションを発行・復元する関数
 */
export async function ensureSupabaseSession(hint?: { userId?: string; displayName?: string }) {
  try {
    // 1. すでに有効なセッションがあるか確認
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return session.user;
    }

    // 2. ユーザーIDの特定（LINEのユーザーID、ローカルストレージ、または固有UUID）
    let baseId = hint?.userId || '';
    if (!baseId && typeof window !== 'undefined') {
      baseId = localStorage.getItem('pdca_auth_uid') || '';
    }
    if (!baseId) {
      baseId = 'u_' + Math.random().toString(36).substring(2, 10);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pdca_auth_uid', baseId);
      }
    }

    const cleanId = baseId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const email = `${cleanId}@pdca.app.internal`;
    const password = `pdca_auth_${cleanId}_2026`;

    // 3. パスワードによる自動ログインを試行
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInData?.session?.user) {
      return signInData.session.user;
    }

    // 4. まだアカウントがない場合は自動サインアップ（新規登録と同時にセッション発行）
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: hint?.displayName || 'LINEユーザー',
          line_user_id: hint?.userId || baseId,
        },
      },
    });

    if (signUpData?.session?.user) {
      return signUpData.session.user;
    }

    // 5. 匿名ログイン（Supabase設定で有効な場合のフォールバック）
    try {
      const { data: anonData } = await supabase.auth.signInAnonymously();
      if (anonData?.session?.user) {
        return anonData.session.user;
      }
    } catch {}

    const { data: finalUser } = await supabase.auth.getUser();
    return finalUser?.user || null;
  } catch (err) {
    console.warn('ensureSupabaseSession warning:', err);
    return null;
  }
}

/**
 * 現在のログインユーザーのID（UUID）を確実に取得する関数
 */
export async function getCurrentUserId(hint?: { userId?: string; displayName?: string }): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;

    const authUser = await ensureSupabaseSession(hint);
    if (authUser?.id) return authUser.id;

    return null;
  } catch (err) {
    console.warn('getCurrentUserId warning:', err);
    return null;
  }
}
