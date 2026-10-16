'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, MessageSquare, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export interface ReviewTargetData {
  planId: string;
  planTitle: string;
  memberName: string;
  versionNumber: number;
  actionPlan: string;
  targetValue: number;
  unit: string;
  operator: 'gte' | 'lte' | 'eq';
  deadline: string;
  totalActual: number;
  recordedDays: number;
  isAchieved: boolean;
  actualSummary: string;
  actionType: string;
  actionReason?: string;
}

interface ReviewModalProps {
  data: ReviewTargetData;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: (actionType?: string, comment?: string) => void;
}

import { getCurrentUserId } from '@/lib/supabase/auth';

export function ReviewModal({ data, isOpen, onClose, onReviewSubmitted }: ReviewModalProps) {
  const [actionType, setActionType] = useState<'confirmed' | 'questioned' | 'revision_requested'>('confirmed');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (actionType === 'questioned' && !comment.trim()) {
      alert('「質問する」を選択した場合は、質問内容を入力してください。');
      return;
    }

    setIsSubmitting(true);
    const finalComment = comment.trim() || (
      actionType === 'confirmed'
        ? '確認しました！この調子で自走を続けてください。'
        : actionType === 'revision_requested'
        ? 'ナイスチャレンジ！次のアクションのヒントや気づきを参考に、次のサイクルを進めてみてください。'
        : '質問内容をご確認ください。'
    );

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = await getCurrentUserId();
      const reviewerId = currentUserId || user?.id || '00000000-0000-0000-0000-000000000001';

      await supabase.from('reviews').insert({
        plan_id: data.planId,
        reviewer_id: reviewerId,
        status: actionType,
        comment: finalComment,
      });
    } catch (err) {
      console.warn('Review save to Supabase failed, local state updated:', err);
    } finally {
      setIsSubmitting(false);
      onReviewSubmitted(actionType, finalComment);
    }
  };

  const operatorLabel = data.operator === 'gte' ? '以上' : data.operator === 'lte' ? '以下' : '一致';

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <span className="text-[10px] font-bold text-gray-400 block">マネージャーレビュー</span>
            <h2 className="text-base font-extrabold text-gray-900">{data.memberName} さんの提出内容</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">1. Plan (目標・判定基準)</span>
            <p className="text-xs font-bold text-slate-900">{data.actionPlan}</p>
            <p className="text-[11px] text-slate-600">
              基準: 毎日 {data.targetValue}{data.unit} {operatorLabel} (期日: {data.deadline || '未定'})
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">2. Do (期間内の実績)</span>
            <p className="text-xs font-bold text-slate-800">
              合計実績: {data.totalActual} {data.unit} (記録日数: {data.recordedDays}日)
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">3. Check (システム判定)</span>
              {data.isAchieved ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  達成 🎉
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  未達成 ⚠️
                </span>
              )}
            </div>
            <p className="text-xs text-slate-700">{data.actualSummary}</p>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">4. Action (本人の選択)</span>
            <p className="text-xs font-bold text-emerald-950">
              方針: {data.actionType === 'continue' ? '継続する' : data.actionType === 'revise' ? '修正する (Ver.UP)' : data.actionType === 'alternative' ? '別の手段を試す' : '終了する'}
            </p>
            {data.actionReason && (
              <p className="text-[11px] text-emerald-800">理由: {data.actionReason}</p>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-900 block">
            レビューアクションを選択
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActionType('confirmed')}
              className={`py-2.5 px-2 rounded-xl border text-center transition ${
                actionType === 'confirmed'
                  ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 mx-auto mb-1 ${actionType === 'confirmed' ? 'text-white' : 'text-emerald-600'}`} />
              <span className="text-xs block font-bold">確認のみ</span>
            </button>

            <button
              type="button"
              onClick={() => setActionType('questioned')}
              className={`py-2.5 px-2 rounded-xl border text-center transition ${
                actionType === 'questioned'
                  ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold ring-1 ring-blue-500'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4 mx-auto mb-1 text-blue-600" />
              <span className="text-xs block font-bold">質問する</span>
            </button>

            <button
              type="button"
              onClick={() => setActionType('revision_requested')}
              className={`py-2.5 px-2 rounded-xl border text-center transition ${
                actionType === 'revision_requested'
                  ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-amber-600" />
              <span className="text-xs block font-bold">アドバイス</span>
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-600 block">
              {actionType === 'confirmed' ? 'メッセージ (任意)' : 'フィードバック / アドバイスコメント (任意)'}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                actionType === 'confirmed'
                  ? '例: 確認しました！この調子で自走を続けてください。'
                  : actionType === 'questioned'
                  ? '例: 今回の未達要因について、行動量と実行方法のどちらに原因があると考えますか？'
                  : '例: ナイスチャレンジ！目標値が高すぎたかもしれないので、毎日続けられる数値に調整してみるのもおすすめです。'
              }
              className="w-full p-2.5 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md active:scale-98 disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                送信中...
              </span>
            ) : actionType === 'confirmed' ? (
              '確認を送信'
            ) : actionType === 'revision_requested' ? (
              'アドバイスを送信'
            ) : (
              '質問を送信'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
