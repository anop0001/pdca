'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, MessageSquare, AlertTriangle } from 'lucide-react';
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

export function ReviewModal({ data, isOpen, onClose, onReviewSubmitted }: ReviewModalProps) {
  const [actionType, setActionType] = useState<'confirmed' | 'questioned' | 'revision_requested'>('confirmed');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if ((actionType === 'questioned' || actionType === 'revision_requested') && !comment.trim()) {
      alert('「質問する」または「修正依頼」を選択した場合は、コメントを入力してください。');
      return;
    }

    setIsSubmitting(true);
    const finalComment = comment.trim() || (actionType === 'confirmed' ? '確認完了しました。この調子で進めてください！' : comment.trim());

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const reviewerId = user?.id || '00000000-0000-0000-0000-000000000001';

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
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
              <span className="text-xs block">確認完了</span>
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
              <span className="text-xs block">質問する</span>
            </button>

            <button
              type="button"
              onClick={() => setActionType('revision_requested')}
              className={`py-2.5 px-2 rounded-xl border text-center transition ${
                actionType === 'revision_requested'
                  ? 'border-red-600 bg-red-50 text-red-800 font-bold ring-1 ring-red-500'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-red-600" />
              <span className="text-xs block">修正依頼</span>
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-600 block">
              {actionType === 'confirmed' ? 'メッセージ (任意)' : 'フィードバック / 問いかけコメント (必須)'}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                actionType === 'confirmed'
                  ? '例: 順調に進んでいます！この調子で次の期間も走り抜けてください。'
                  : actionType === 'questioned'
                  ? '例: 今回の未達要因について、行動量と実行方法のどちらに原因があると考えますか？'
                  : '例: 目標基準が少し曖昧です。毎日数値でYes/Noがわかる指標に再設定してみてください。'
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
            {isSubmitting ? '送信中...' : 'レビューを確定して送信'}
          </button>
        </div>
      </div>
    </div>
  );
}
