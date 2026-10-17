import { z } from 'zod';

export const planWizardSchema = z.object({
  objectiveMode: z.enum(['select', 'create']),
  selectedObjectiveId: z.string().optional(),
  newObjectiveTitle: z.string().optional(),
  objectiveWhat: z.string().optional(),
  objectiveWhen: z.string().optional(),
  objectiveState: z.string().optional(),
  actionPlan: z.string().min(2, '実行内容は2文字以上で入力してください'),
  targetValue: z.number({ invalid_type_error: '数値を入力してください' }).positive('1以上の数値を入力してください'),
  unit: z.string().min(1, '単位を入力または選択してください'),
  operator: z.enum(['gte', 'lte', 'eq']),
  frequency: z.enum(['daily', 'weekday', 'weekly', 'single']),
  deadline: z.string().min(1, '評価期限を選択してください'),
}).refine((data) => {
  if (data.objectiveMode === 'select') {
    return !!data.selectedObjectiveId;
  }
  const hasThreeFields = !!data.objectiveWhat?.trim() && !!data.objectiveWhen?.trim() && !!data.objectiveState?.trim();
  const hasTitle = !!data.newObjectiveTitle && data.newObjectiveTitle.trim().length > 0;
  return hasThreeFields || hasTitle;
}, {
  message: '「何を」「いつまでに」「どういった状態」の3項目をすべて入力してください',
  path: ['objectiveWhat'],
});

export type PlanWizardFormData = z.infer<typeof planWizardSchema>;
