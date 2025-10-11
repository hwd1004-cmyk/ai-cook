import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { AnyInputSchema, RecipeSchema } from '@/lib/schema'
import { SYSTEM_PROMPT, pantryUserPrompt, dishUserPrompt } from '@/lib/prompt'
import { extractJson } from '@/lib/json'

export const runtime = 'nodejs'

/* -----------------------------------------------------------
 * ① 재료 라벨 보정기 (서버측)
 *    - 모델이 type을 안 보냈거나 부정확할 때 필수/선택/대체를 분류
 * ---------------------------------------------------------*/
type Ing = {
  name: string
  qty?: string
  optional?: boolean
  substitution?: string
  type?: '필수' | '선택' | '대체'
}

const BASIC_OPTIONALS = new Set([
  '소금','맛소금','후추','후춧가루',
  '식용유','올리브유','카놀라유','버터','마가린','참기름',
  '식초','설탕','꿀','간장','고춧가루','고추장','된장',
  '다진마늘','마늘',
  '물','전분','옥수수전분','밀가루',
  '파','대파','쪽파'
])

function norm(s: string) {
  return s
    .replace(/\s/g, '')
    .replace(/[—–\-·•,()]/g, '')
    .toLowerCase()
}

function classify(ing: Ing): '필수' | '선택' | '대체' {
  const t = ing.type?.toString().trim()
  if (t === '대체') return '대체'
  if (t === '선택') return '선택'

  if (typeof ing.substitution === 'string' && ing.substitution.trim()) return '대체'
  if (ing.optional === true) return '선택'

  const key = norm(ing.name || '')
  if (BASIC_OPTIONALS.has(ing.name) || Array.from(BASIC_OPTIONALS).some(b => key.includes(norm(b)))) {
    return '선택'
  }
  return '필수'
}

function normalizeRecipeTypes(recipe: any) {
  if (Array.isArray(recipe?.ingredients)) {
    recipe.ingredients = recipe.ingredients.map((raw: any) => {
      const ing: Ing = { ...raw }
      const newType = classify(ing)
      return { ...ing, type: newType }
    })
  }
  return recipe
}

/* -----------------------------------------------------------
 * ② 타이머 보정기 (옵션 A: 기본 요리 감각)
 *    - 가열/조리 동사가 있는 단계만 타이머 유지
 *    - 나머지는 timerSec 제거
 * ---------------------------------------------------------*/
const COOKING_VERBS = [
  '볶', '끓', '굽', '튀기', '익히', '데치', '졸이', '삶', '부쳐', '지지',
  '조리', '예열', '오븐', '가열', '에어프라이', '식히', '굳히'
]
const NON_TIMER_HINTS = [
  '썰', '다지', '씻', '섞', '버무리', '준비', '계량',
  '넣', '추가', '담', '올리', '보관', '꺼내', '장식'
]

function needsTimer(instruction: string): boolean {
  const s = instruction.replace(/\s/g, '')
  if (NON_TIMER_HINTS.some(k => s.includes(k))) return false
  return COOKING_VERBS.some(k => s.includes(k))
}

function applyTimerPolicy(recipe: any) {
  if (!Array.isArray(recipe?.steps)) return recipe
  const steps = recipe.steps.map((st: any) => {
    const hasTimer = typeof st?.timerSec === 'number' && st.timerSec > 0
    if (!hasTimer) return { ...st, timerSec: undefined }

    const inst = String(st?.instruction ?? '')
    if (!needsTimer(inst)) {
      return { ...st, timerSec: undefined }
    }

    // 과도한 값만 간단히 클램프 (10초 ~ 60분)
    const sec = Math.round(st.timerSec)
    const clamped = Math.max(10, Math.min(sec, 60 * 60))
    return { ...st, timerSec: clamped }
  })
  return { ...recipe, steps }
}

/* -----------------------------------------------------------
 * ③ 메인 핸들러
 * ---------------------------------------------------------*/
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = AnyInputSchema.parse(body)

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const userPrompt =
      parsed.mode === 'pantry' ? pantryUserPrompt(parsed) : dishUserPrompt(parsed)

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_completion_tokens: 800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = completion.choices?.[0]?.message?.content
    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'AI 응답이 비어있습니다.' }, { status: 500 })
    }

    // 1) JSON 추출
    let json
    try {
      json = extractJson(content)
    } catch {
      console.error('원본 응답:', content)
      return NextResponse.json({ error: 'JSON 파싱 실패: 응답 형식이 잘못되었습니다.' }, { status: 500 })
    }

    // 2) 스키마 검증
    const recipe = RecipeSchema.parse(json)

    // 3) 서버 보정: 재료 type 보정 → 타이머 보정(옵션 A)
    const withTypes = normalizeRecipeTypes({ ...recipe })
    const adjusted = applyTimerPolicy(withTypes)

    // 4) 결과
    return NextResponse.json(adjusted)
  } catch (err: any) {
    console.error('[API ERROR]', err)
    return NextResponse.json({ error: err?.message || '서버 오류' }, { status: 500 })
  }
}
