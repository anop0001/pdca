import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getLineAuthCredentials } from '@/lib/supabase/auth';

export async function POST(request: Request) {
  try {
    const { idToken, displayName, avatarUrl } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const liffChannelId = process.env.LINE_CHANNEL_ID || process.env.NEXT_PUBLIC_LIFF_ID?.split('-')[0];
    if (!liffChannelId) {
      return NextResponse.json({ error: 'LINE_CHANNEL_ID is not configured' }, { status: 500 });
    }

    const verifyParams = new URLSearchParams({
      id_token: idToken,
      client_id: liffChannelId,
    });

    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });

    if (!verifyRes.ok) {
      const errorData = await verifyRes.json();
      return NextResponse.json({ error: 'Invalid ID token', details: errorData }, { status: 401 });
    }

    const verifyData = await verifyRes.json();
    const lineUserId = verifyData.sub;

    const { email: authEmail, password: tempPassword } = getLineAuthCredentials(lineUserId);

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let authUser = existingUsers?.users.find((u) => u.email === authEmail);

    if (!authUser) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { line_user_id: lineUserId, display_name: displayName },
      });
      if (createError || !newUser.user) {
        throw createError || new Error('ユーザー作成失敗');
      }
      authUser = newUser.user;
    }

    await supabaseAdmin.from('users').upsert({
      id: authUser.id,
      line_user_id: lineUserId,
      display_name: displayName || 'LINE User',
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    });

    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authEmail,
      password: tempPassword,
    });

    if (signInError || !sessionData.session) {
      throw signInError || new Error('セッション発行失敗');
    }

    return NextResponse.json({
      token: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    });
  } catch (error: any) {
    console.error('LINE Auth API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
