import { supabase } from '@/lib/supabase/client';

/**
 * LINEユーザーIDから全環境（PC/スマホ）共通の確定的な認証情報を生成
 */
export function getLineAuthCredentials(lineUserId: string) {
  const cleanId = lineUserId.trim();
  const email = `line_${cleanId.toLowerCase()}@pdca.app.internal`;
  const password = `pdca_line_auth_${cleanId}_2026`;
  return { email, password, cleanId };
}

/**
 * セッション未確立時に自動的・強制的にSupabaseセッションを発行・復元する関数
 */
export async function ensureSupabaseSession(hint?: { userId?: string; displayName?: string }) {
  try {
    let targetLineId = hint?.userId || '';
    if (!targetLineId && typeof window !== 'undefined') {
      targetLineId = localStorage.getItem('pdca_line_user_id') || '';
    }

    // 1. すでに有効なセッションがあるか確認
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (targetLineId) {
        const metaLineId = session.user.user_metadata?.line_user_id;
        const currentEmail = session.user.email || '';
        const { email: expectedEmail } = getLineAuthCredentials(targetLineId);

        // 現在のセッションが指定されたLINEユーザーと一致していればそのまま継続
        if (metaLineId === targetLineId || currentEmail.toLowerCase() === expectedEmail.toLowerCase()) {
          return session.user;
        }

        // 一時的・ランダムなセッションだった場合は一度サインアウトしてLINEアカウントでサインイン
        await supabase.auth.signOut();
      } else {
        return session.user;
      }
    }

    // 2. 認証情報の特定
    let email: string;
    let password: string;
    let displayName = hint?.displayName || 'LINEユーザー';

    if (targetLineId) {
      const creds = getLineAuthCredentials(targetLineId);
      email = creds.email;
      password = creds.password;
      if (typeof window !== 'undefined') {
        localStorage.setItem('pdca_line_user_id', targetLineId);
      }
    } else {
      let baseId = '';
      if (typeof window !== 'undefined') {
        baseId = localStorage.getItem('pdca_auth_uid') || '';
      }
      if (!baseId) {
        baseId = 'u_' + Math.random().toString(36).substring(2, 12);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pdca_auth_uid', baseId);
        }
      }
      email = `${baseId}@pdca.app.internal`;
      password = `pdca_auth_${baseId}_2026`;
    }

    // 3. パスワードによる自動ログインを試行（別端末ですでに作成済みのアカウントにもここでログインできる）
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInData?.session?.user) {
      return signInData.session.user;
    }

    // 4. まだアカウントがない場合は自動サインアップ（新規登録と同時にセッション発行）
    const { data: signUpData } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          line_user_id: targetLineId || undefined,
        },
      },
    });

    if (signUpData?.session?.user) {
      return signUpData.session.user;
    }

    // 5. サインアップ直後のリトライログイン
    const { data: retrySignIn } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (retrySignIn?.session?.user) {
      return retrySignIn.session.user;
    }

    // 6. 匿名ログインフォールバック
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
    const authUser = await ensureSupabaseSession(hint);
    if (authUser?.id) return authUser.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;

    return null;
  } catch (err) {
    console.warn('getCurrentUserId warning:', err);
    return null;
  }
}
