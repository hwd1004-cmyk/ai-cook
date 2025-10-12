import { z } from 'zod'

export const IngredientSchema = z.object({
  name: z.string(),
  qty: z.string().optional().default(''),
  optional: z.boolean().optional().default(false), // 과거 호환용
  substitution: z.string().optional(),
  // 재료 타입 라벨(서버/클라이언트 보정과 함께 사용)
  type: z.enum(['필수', '선택', '대체']).optional().default('필수'),
})

export const StepSchema = z.object({
  order: z.number().int().positive(),
  instruction: z.string(),
  // ⬇️ 0초가 들어와도 파싱 통과 → 이후 서버에서 보정/제거
  timerSec: z.number().int().nonnegative().optional(),
})

export const NutritionSchema = z.object({
  kcal: z.number().nonnegative().optional().default(0),
  protein: z.number().nonnegative().optional().default(0),
  fat: z.number().nonnegative().optional().default(0),
  carb: z.number().nonnegative().optional().default(0),
})

export const RecipeSchema = z.object({
  title: z.string(),
  cookingTimeMin: z.number().int().positive().optional().default(15),
  difficulty: z.enum(['초급', '중급', '고급']).optional().default('초급'),
  ingredients: z.array(IngredientSchema),
  steps: z.array(StepSchema).min(1),
  // Vercel 빌드 에러 회피: default 제거, optional만
  nutrition: NutritionSchema.optional(),
  tips: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
})

export type Recipe = z.infer<typeof RecipeSchema>

export const PantryInputSchema = z.object({
  mode: z.literal('pantry'),
  ingredients: z.array(z.string()).min(1),
  servings: z.number().int().positive().default(2),
  timeLimit: z.number().int().positive().max(240).default(30),
  allergies: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  diets: z.array(z.string()).default([]),
})

export const DishInputSchema = z.object({
  mode: z.literal('dish'),
  dishName: z.string().min(1),
  servings: z.number().int().positive().default(2),
  timeLimit: z.number().int().positive().max(240).default(30),
  allergies: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  diets: z.array(z.string()).default([]),
})

export const AnyInputSchema = z.discriminatedUnion('mode', [
  PantryInputSchema,
  DishInputSchema,
])

export type AnyInput = z.infer<typeof AnyInputSchema>
