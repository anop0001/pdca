'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/auth';
import { useLiff } from '@/components/liff-provider';
import { planWizardSchema, type PlanWizardFormData } from '@/lib/validations/plan';

import { Step1Objective } from '@/components/plan-wizard/step1-objective';
import { Step2Action } from '@/components/plan-wizard/step2-action';
import { Step3Criteria } from '@/components/plan-wizard/step3-criteria';

export default function NewPlanPage() {
  const router = useRouter();
  const { user: liffUser } = useLiff();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const methods = useForm<PlanWizardFormData>({
    resolver: zodResolver(planWizardSchema),
    defaultValues: {
      objectiveMode: 'select',
      selectedObjectiveId: '',
      newObjectiveTitle: '',
      actionPlan: '',
      targetValue: 1,
      unit: '回',
      operator: 'gte',
      frequency: 'daily',
      deadline: defaultDeadline,
    },
    mode: 'onChange',
  });

  const { handleSubmit, trigger } = methods;

  const handleNextStep = async () => {
    let isValid = false;
    if (currentStep === 1) {
      isValid = await trigger(['objectiveMode', 'selectedObjectiveId', 'newObjectiveTitle']);
    } else if (currentStep === 2) {
      isValid = await trigger(['actionPlan']);
    }

    if (isValid) {
      setCurrentStep((prev) => (prev + 1) as 2 | 3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (prev - 1) as 1 | 2);
  };

  const onSubmit = async (data: PlanWizardFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // ユーザーIDを取得（LIFFプロファイルまたはSupabaseセッションから特定）
      const currentUserId = (await getCurrentUserId(liffUser || undefined)) || '00000000-0000-0000-0000-000000000001';

      let finalObjectiveId = data.selectedObjectiveId;
      let newPlanId = 'plan-' + Date.now();

      // 1. Supabaseへの保存を試みる
      try {
        if (data.objectiveMode === 'create' && data.newObjectiveTitle?.trim()) {
          const { data: newObj } = await supabase
            .from('objectives')
            .insert({
              user_id: currentUserId,
              title: data.newObjectiveTitle.trim(),
              status: 'active',
            })
            .select('id')
            .maybeSingle();

          if (newObj?.id) {
            finalObjectiveId = newObj.id;
          }
        }

        const { data: newPlan } = await supabase
          .from('plans')
          .insert({
            objective_id: finalObjectiveId || null,
            user_id: currentUserId,
            title: data.actionPlan,
            status: 'in_progress',
          })
          .select('id')
          .maybeSingle();

        if (newPlan?.id) {
          newPlanId = newPlan.id;
          await supabase
            .from('plan_versions')
            .insert({
              plan_id: newPlan.id,
              user_id: currentUserId,
              version_number: 1,
              action_plan: data.actionPlan,
              target_value: data.targetValue,
              unit: data.unit,
              operator: data.operator,
              frequency: data.frequency === 'weekday' ? 'custom' : data.frequency,
              deadline: data.deadline,
            });
        }
      } catch (sbErr) {
        console.warn('Supabase save warning (fallback to local):', sbErr);
      }

      // 2. ローカルストレージにも確実にキャッシュ保存（オフラインやセッション未確立時でも即座に反映）
      if (typeof window !== 'undefined') {
        let objectiveTitle = data.newObjectiveTitle?.trim() || '';
        if (!objectiveTitle && finalObjectiveId) {
          try {
            const { data: objData } = await supabase
              .from('objectives')
              .select('title')
              .eq('id', finalObjectiveId)
              .maybeSingle();
            if (objData?.title) objectiveTitle = objData.title;
          } catch {}
        }
        if (!objectiveTitle) objectiveTitle = '目標設定';

        const localPlan = {
          id: newPlanId,
          userId: currentUserId,
          title: data.actionPlan,
          status: 'in_progress',
          objectiveTitle: objectiveTitle,
          currentVersion: {
            id: 'ver-' + Date.now(),
            version_number: 1,
            action_plan: data.actionPlan,
            target_value: data.targetValue,
            unit: data.unit,
            operator: data.operator,
            frequency: data.frequency === 'weekday' ? 'custom' : data.frequency,
            deadline: data.deadline || '',
          },
          todayRecord: null,
          created_at: new Date().toISOString(),
        };

        const existingRaw = localStorage.getItem('pdca_local_plans');
        const existingList = existingRaw ? JSON.parse(existingRaw) : [];
        if (!existingList.some((p: any) => p.id === newPlanId)) {
          existingList.unshift(localPlan);
          localStorage.setItem('pdca_local_plans', JSON.stringify(existingList));
        }
        window.dispatchEvent(new Event('pdca_plans_updated'));
      }

      router.push(`/?created_plan_id=${newPlanId}`);
    } catch (err: any) {
      console.error('Plan Creation Error:', err);
      setSubmitError(err.message || '計画の保存中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-[calc(100vh-5rem)] flex flex-col justify-between py-2">
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-emerald-600 tracking-wider">
            STEP {currentStep} OF 3
          </span>
          <span className="text-xs text-gray-400">
            {currentStep === 1 && '目的設定'}
            {currentStep === 2 && '実行内容'}
            {currentStep === 3 && '判定基準'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentStep >= step ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {submitError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
            {submitError}
          </div>
        )}

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 1 && <Step1Objective />}
            {currentStep === 2 && <Step2Action />}
            {currentStep === 3 && <Step3Criteria />}
          </form>
        </FormProvider>
      </div>

      <div className="sticky bottom-14 left-0 right-0 pt-4 pb-2 bg-white/95 backdrop-blur-sm border-t border-gray-100 mt-6">
        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm flex items-center justify-center gap-1 active:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              戻る
            </button>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-[2] py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1 shadow-sm active:bg-emerald-700 transition"
            >
              次へ進む
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="flex-[2] py-3.5 px-4 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:bg-emerald-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  この内容でPlanを確定する
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
