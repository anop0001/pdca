'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Target, 
  PlayCircle, 
  CheckCircle2, 
  RefreshCw, 
  Users, 
  Share2, 
  AlertTriangle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  BookOpen,
  MessageSquare,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: 'personal' | 'team' | 'general';
}

const FAQS: FaqItem[] = [
  {
    category: 'personal',
    question: 'Plan（目標）にはどんな内容を設定すればいいですか？',
    answer: '「毎日20件テレアポする」「週に3日、30分筋トレする」など、数値で測定できる具体的な【行動（Do）】を設定するのがPDCAを回す最大のコツです。曖昧な目標（「営業を頑張る」など）だと、Check（評価）の際に達成・未達が客観的に判断できなくなってしまいます。',
  },
  {
    category: 'personal',
    question: '実績（Do）の記録を間違えた場合は修正できますか？',
    answer: 'はい、ホーム画面の各目標カードにある「鉛筆（編集）アイコン」をタップすると、目標の内容や設定数値をいつでも編集・修正できます。また、ゴミ箱アイコンから削除することも可能です。',
  },
  {
    category: 'personal',
    question: 'Check（評価）はどのタイミングで行うべきですか？',
    answer: '設定したサイクルの期限日（日次・週次など）が到来した際、または目標の実績入力を終えたタイミングで「Check（評価）へ進む」を押してください。達成率が自動計算され、良かった点・改善すべき課題を振り返ることができます。',
  },
  {
    category: 'personal',
    question: 'Action（改善）で次サイクルへ更新するとどうなりますか？',
    answer: 'Checkで振り返った課題をもとに改善計画（次バージョンのPlan）を作成すると、目標のバージョンが自動で「v1 ➔ v2」へと更新され、過去の実績は「履歴」タブに蓄積されます。これによりPDCAが螺旋状に進化（スパイラルアップ）します。',
  },
  {
    category: 'team',
    question: 'メンバーはどうやって追加・招待すればいいですか？',
    answer: '「チーム管理」画面の【LINE友だちを追加】ボタンをタップしてください。送信メッセージのプレビューが表示され、送信ボタンを押すとLINEの友だちリストから直接招待状を送信できます。相手がLINE内の参加リンクを開くだけでチームに加わります。',
  },
  {
    category: 'team',
    question: 'LINEの友だち選択画面が開かない場合はどうすればいいですか？',
    answer: 'モーダル内の【招待リンクをコピー】ボタンをタップし、コピーされた参加URLをご自身のLINEトークやグループチャットに直接貼り付けて送信してください。URLを開けば同様に参加できます。',
  },
  {
    category: 'team',
    question: 'チーム名や招待コードを変更したいです。',
    answer: '「チーム管理」画面上部にあるチーム名横の【✏️ 変更】ボタン、またはコード横の【設定】リンクから、いつでも自由なチーム名（例: 〇〇部、プロジェクトAチーム）や招待コードに変更・保存できます。',
  },
  {
    category: 'team',
    question: 'サイクルの滞り（アラート）とは何ですか？',
    answer: 'メンバーの目標で「期限が過ぎているのにCheckがされていない」「実績が未達のまま停滞している」「管理者の承認待ちになっている」状態を検知して表示します。管理者が早期にアドバイスやレビューを送ることで、メンバーの放置や挫折を防ぐことができます。',
  },
  {
    category: 'team',
    question: 'メンバーを除名（削除）することはできますか？',
    answer: 'はい、チーム管理のメンバー一覧にある【🗑️ 除名】ボタンをタップすると、そのメンバーをチームから即時解除できます。',
  },
  {
    category: 'general',
    question: 'LINEミニアプリを閉じた後、データは消えませんか？',
    answer: 'はい、データはクラウド（Supabase）およびLINEアカウントに安全に保存されているため、アプリを閉じたり再起動しても消えることはありません。いつでも前回の続きから再開できます。',
  },
];

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'faq'>('personal');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="max-w-md mx-auto space-y-5 pb-12 animate-in fade-in duration-200">
      {/* 上部ナビゲーション */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition px-2 py-1 -ml-1 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ホームへ戻る</span>
        </Link>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
          <BookOpen className="w-3 h-3 text-emerald-600" />
          公式ガイド
        </span>
      </div>

      {/* ヒーローヘッダー */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white shadow-md space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-semibold text-emerald-100">
          <Sparkles className="w-3 h-3 text-amber-300" />
          PDCA Check 使い方マニュアル
        </div>
        <h1 className="text-lg font-black tracking-tight leading-snug">
          PDCAサイクルを高速で回し、<br />目標を確実に達成する方法
        </h1>
        <p className="text-xs text-emerald-100 leading-relaxed pt-1">
          日々の小さな実績記録から、自己評価・改善の更新、チームメンバーの進捗管理まで、アプリの使い方をわかりやすく解説します。
        </p>
      </div>

      {/* タブ切り替えバー */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('personal')}
          className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'personal'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👤</span> 個人PDCA
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'team'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👥</span> チーム管理
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'faq'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" /> よくある質問
        </button>
      </div>

      {/* 1. 個人PDCAの使い方タブ */}
      {activeTab === 'personal' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-extrabold text-slate-900">個人PDCAの4つのステップ</h2>
          </div>

          {/* Step 1: Plan */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-xs">
                <Target className="w-4 h-4 text-blue-600" />
                Step 1: Plan（計画・目標）
              </span>
              <span className="text-[10px] font-bold text-slate-400">行動目標の設定</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900">測定可能な「具体的な数値」をセットする</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              画面下の【Plan作成】から目標を登録します。「頑張る」ではなく、
              「毎日20件架電する」「週3日30分ウォーキング」のように、
              <strong className="text-slate-800">数値（目標値）と単位</strong>をセットにするのがポイントです。
            </p>
            <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-[10px] text-blue-800 flex items-start gap-1.5">
              <span className="text-xs">💡</span>
              <span><strong>成功のコツ:</strong> 達成確率が80%程度と感じられる現実的な数字から始めると、毎日の継続習慣が身につきます。</span>
            </div>
          </div>

          {/* Step 2: Do */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs">
                <PlayCircle className="w-4 h-4 text-emerald-600" />
                Step 2: Do（実行・記録）
              </span>
              <span className="text-[10px] font-bold text-slate-400">日々のワンタップ記録</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900">毎日の実績を隙間時間に即時記録</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              ホーム画面に登録した目標が表示されます。日々の業務や行動が終わったら、
              【＋1】【＋5】クイックボタンや数値入力で実績をサッと記録します。
            </p>
            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[10px] text-emerald-800 flex items-start gap-1.5">
              <span className="text-xs">📱</span>
              <span><strong>LINEだから続く:</strong> LINEアプリ内で直接動くため、移動中や仕事の合間にストレスなく数秒で記録完了できます。</span>
            </div>
          </div>

          {/* Step 3: Check */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-extrabold text-xs">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                Step 3: Check（評価・振り返り）
              </span>
              <span className="text-[10px] font-bold text-slate-400">達成率と課題の分析</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900">目標値 vs 実績値を自動照合して検証</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              期間満了時や振り返り時に【Check（評価）へ進む】をタップします。
              達成率（％）が自動算出され、達成（🎉）または未達（⚠️）が判定されます。
              「なぜ達成できたか？」「何がボトルネックだったか？」を一言メモします。
            </p>
          </div>

          {/* Step 4: Action */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-xs">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                Step 4: Action（改善・次の計画）
              </span>
              <span className="text-[10px] font-bold text-slate-400">次サイクルへ更新</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900">改善策を反映し、Planをバージョンアップ</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Checkの分析をもとに、次サイクルの目標値や行動内容を更新して保存します。
              目標は自動で「v2 ➔ v3」と進化し、過去の記録は「履歴」タブに蓄積されます。
            </p>
            <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-100 text-[10px] text-purple-800 flex items-start gap-1.5">
              <span className="text-xs">🚀</span>
              <span><strong>スパイラルアップ:</strong> 失敗しても計画を見直して再挑戦することで、確実に業務成果や目標達成力が向上します。</span>
            </div>
          </div>

          <Link
            href="/plans/new"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
          >
            <span>さっそくPlan（目標）を作成してみる</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 2. チーム管理の使い方タブ */}
      {activeTab === 'team' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <h2 className="text-sm font-extrabold text-slate-900">チーム管理（管理者向け）の使い方</h2>
          </div>

          {/* チーム開設 */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs">1</div>
              <span>チームを開設する</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              画面上の【チーム管理】を開き、開設ボタンを押すだけで管理者になります。
              チーム名は最初から「[あなたのアカウント名]チーム」がセットされていますが、
              画面上部の【✏️ 変更】からいつでも好きな名称に変更できます。
            </p>
          </div>

          {/* LINE招待 */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs">2</div>
              <span>LINEの友だちを招待する</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              【LINE友だちを追加】をタップすると、招待メッセージの作成画面が開きます。
              メッセージ文面を確認・編集し、【LINEの友だちを選択して送信】を押すと、
              LINEの友だちリストから招待したいメンバーを選んで即座に送信できます。
            </p>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 flex items-start gap-1.5">
              <span className="text-xs">🔗</span>
              <span><strong>URL共有も可能:</strong> LINE友だち選択が利用できない場合でも、【招待リンクをコピー】でトークやグループに直接送信できます。</span>
            </div>
          </div>

          {/* 滞り検知 */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs">3</div>
              <span>サイクルの滞りをリアルタイム検知</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              配下メンバーのPDCAが滞っていないかをダッシュボードで自動検知します。
            </p>
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-800 block">確認待ち</span>
                <span className="text-[9px] text-amber-600">Check提出済みで要レビュー</span>
              </div>
              <div className="p-2 bg-red-50 rounded-xl border border-red-200">
                <span className="text-[10px] font-bold text-red-800 block">再提出待ち</span>
                <span className="text-[9px] text-red-600">修正依頼にメンバーが対応中</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 block">確認完了</span>
                <span className="text-[9px] text-emerald-600">順調に自走して進行中</span>
              </div>
            </div>
          </div>

          {/* レビュー */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs">4</div>
              <span>レビュー & フィードバック</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              メンバーのカードにある【提出内容をレビューする】をタップすると、
              実績とコメントを確認し、【✅ 確認完了（承認）】または【⚠️ 修正依頼】をアドバイスコメント付きで送信できます。
            </p>
          </div>

          <Link
            href="/team"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
          >
            <span>チーム管理画面を開く</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 3. よくある質問 (FAQ) タブ */}
      {activeTab === 'faq' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-extrabold text-slate-900">よくあるご質問（FAQ）</h2>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => {
              const isOpen = openFaqIndex === i;
              return (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(i)}
                    className="w-full p-3.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                        Q
                      </span>
                      <span className="text-xs font-bold text-slate-800 leading-snug">
                        {faq.question}
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="p-3.5 pt-0 border-t border-slate-100 bg-slate-50/50">
                      <div className="flex items-start gap-2 pt-2 text-[11px] text-slate-600 leading-relaxed">
                        <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          A
                        </span>
                        <div className="pt-0.5">
                          {faq.answer}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* フッターサポート */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
        <span className="text-xs font-bold text-slate-700 block">ご不明点・フィードバック</span>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          アプリの機能改善要望や不具合報告は、LINE公式アカウントのトークよりいつでもお気軽にお知らせください。
        </p>
      </div>
    </div>
  );
}
