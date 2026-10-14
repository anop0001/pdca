# PDCA Check - 目標管理 LINEミニアプリ (MVP)

「PDCAを記録する」のではなく、「目的達成に向けてPlanを改善し続ける」ための目標管理ツール。
LINEミニアプリ（LIFF）としてモバイルWebファーストで動作します。

## 技術スタック
- フロントエンド: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- LINE連携: LIFF SDK (`@line/liff`)
- バックエンド/DB: Supabase (PostgreSQL + RLS)
- バリデーション: Zod + React Hook Form
- デプロイ先: Vercel

## 画面一覧
- `/`: ホーム画面（本日のDo入力、ワンタップ完了・数値カウンター、進捗バー）
- `/plans/new`: Plan作成 3段階ウィザード（目的選択 ➔ 行動入力 ➔ 判定基準設定）
- `/plans/[id]/check`: Check & 4択Action画面（自動達成判定、4択方針選択、Ver.UP改訂）
- `/team`: チーム状況ダッシュボード（サイクルの滞り検知、レビューモーダル）
- `/history`: 改善タイムライン画面（バージョン変遷と自己効力感の可視化）

## Vercel 環境変数設定
- `NEXT_PUBLIC_LIFF_ID`: LINE DevelopersのLIFF ID
- `LINE_CHANNEL_ID`: LINE DevelopersのチャネルID
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service_role key
- `SUPABASE_AUTH_SECRET`: JWT Secret
