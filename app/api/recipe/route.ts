import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { AnyInputSchema, RecipeSchema } from '@/lib/schema'
import { SYSTEM_PROMPT, pantryUserPrompt, dishUserPrompt } from '@/lib/prompt'
import { extractJson } from '@/lib/json'

export const runtime = 'nodejs'

/* ------------------ 재료 라벨 보정 ------------------ */
type Ing = {
  name: string
  qty?: string
  optional?: boolean
  substitution?: string
  type?: '필수' | '선택' | '대체'
}

// “조미료/향신료/기름” 관용 세트(모델이 type 누락했을 때만 참고)
const SEASONINGS = [
  '소금','후추','식용유','올리브유','카놀라유','버터','마가린','참기름','식초',
  '설탕','꿀','간장','고춧가루','고추장','된장','다진마늘','마늘','후춧가루'
].map(s => s.replace(/\s/g,'').toLowerCase())

function norm(s: string) {
  return (s || '').replace(/\s/g,'').toLowerCase()
}

function looksLikeSeasoning(name: string) {
  const n = norm(name)
  return SEASONINGS.some(sw => n.includes(sw))
}

// dishName/타이틀로 핵심 힌트 추출
const CORE_HINTS = [
  // 면/밥/쌀
  '파스타','스파게티','면','국수','라면','우동','소바','냉면','칼국수','밥','쌀','라이스',
  // 대표 단백질/핵심 재료
  '닭','닭고기','돼지고기','소고기','두부','계란','달걀','베이컨','삼겹살','새우','오징어','문어','조개','홍합','김치'
].map(s => s.replace(/\s/g,'').toLowerCase())

function hasCoreHint(str: string) {
  const n = norm(str)
  return CORE_HINTS.some(hw => n.includes(hw))
}

function promoteCoreIngredients(recipe: any, dishNameOrTitle: string) {
  if (!Array.isArray(recipe?.ingredients)) return recipe
  const core = hasCoreHint(dishNameOrTitle)
  if (!core) return recipe

  recipe.ingredients = recipe.ingredients.map((ing: any) => {
    const isCoreIng = hasCoreHint(ing?.name || '')
    if (!ing?.type && isCoreIng) return { ...ing, type: '필수' as const }
    if (ing?.type && isCoreIng && ing.type !== '필수') return { ...ing, type: '필수' as const }
    return ing
  })
  return recipe
}

function normalizeRecipeTypes(recipe: any) {
  if (!Array.isArray(recipe?.ingredients)) return recipe

  let anyEssential = false

  recipe.ingredients = recipe.ingredients.map((raw: any) => {
    const ing: Ing = { ...raw }
    // 1) 모델이 준 type을 우선 신뢰
    let t = ing.type

    // 2) 없으면 최소한의 추론만 (양념류는 선택, 그 외 필수)
    if (!t) {
      t = looksLikeSeasoning(ing.name) ? '선택' : '필수'
    }

    if (t === '필수') anyEssential = true
    return { ...ing, type: t }
  })

  // 3) 모든 재료가 선택/대체로만 나온 경우 → 첫 번째 비-양념 재료를 필수로 승격
  if (!anyEssential) {
    const idx = recipe.ingredients.findIndex((ing: any) => !looksLikeSeasoning(ing.name))
    if (idx >= 0) {
      recipe.ingredients[idx] = { ...recipe.ingredients[idx], type: '필수' }
    } else if (recipe.ingredients.length > 0) {
      // 전부 양념뿐인 비정상 응답 대비
      recipe.ingredients[0] = { ...recipe.ingredients[0], type: '필수' }
    }
  }

  return recipe
}

/* ------------------ 타이머 보정 ------------------ */
const COOKING_VERBS = [
  '볶','끓','굽','튀기','익히','데치','졸이','삶','부쳐','지지',
  '조리','예열','오븐','가열','에어프라이','식히','굳히'
]
const NON_TIMER_HINTS = [
  '썰','다지','씻','섞','버무리','준비','계량',
  '넣','추가','담','올리','보관','꺼내','장식'
]

// 패턴: 8~10분, 8-10분, 8분, 30초, 약 8분 등
const RANGE_MIN_MAX = /(\d+)\s*[~\-–]\s*(\d+)\s*(분|초)/;
const SINGLE_VAL   = /(?:약|대략|정도|약간)?\s*(\d+)\s*(분|초)/;

function secondsFromMatch(n: number, unit: string) {
  const sec = unit === '분' ? n * 60 : n
  return Math.max(10, Math.min(sec, 60 * 60))
}

/** 문장에 시간 표현이 있으면 초 단위로 추출 */
function extractTimerFromText(text: string): number | undefined {
  const s = text.replace(/\s+/g, '')
  const m1 = s.match(RANGE_MIN_MAX)
  if (m1) {
    const a = Number(m1[1]), b = Number(m1[2])
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const mid = Math.round((a + b) / 2)
      return secondsFromMatch(mid, m1[3])
    }
  }
  const m2 = s.match(SINGLE_VAL)
  if (m2) {
    const v = Number(m2[1])
    if (Number.isFinite(v)) {
      return secondsFromMatch(v, m2[2])
    }
  }
  return undefined
}

/** 가열/조리 단계인지 여부 (명시 시간 있으면 가열 아니어도 타이머 유지) */
function isCookingStep(instruction: string): boolean {
  const s = instruction.replace(/\s/g, '')
  if (COOKING_VERBS.some(k => s.includes(k))) return true
  // 시간이 문장에 명시된 경우(해감 등)도 타이머 유지
  if (RANGE_MIN_MAX.test(s) || SINGLE_VAL.test(s)) return true
  return false
}

/** 가열 동사에 따른 기본값(초) */
function defaultSecondsByVerb(instruction: string): number | undefined {
  const s = instruction.replace(/\s/g, '')
  const pick = (v: number) => v
  if (s.includes('볶')) return pick(120)          // 2분
  if (s.includes('끓') || s.includes('졸이')) return pick(600) // 10분
  if (s.includes('삶')) return pick(600)          // 10분
  if (s.includes('굽') || s.includes('지지') || s.includes('부쳐')) return pick(420) // 7분
  if (s.includes('데치')) return pick(90)         // 1.5분
  if (s.includes('튀기')) return pick(180)        // 3분
  if (s.includes('예열') || s.includes('가열') || s.includes('오븐') || s.includes('에어프라이')) return pick(180) // 3분
  if (s.includes('식히') || s.includes('굳히')) return pick(300) // 5분
  return undefined
}

function preSanitizeJson(raw: any) {
  if (!raw || !Array.isArray(raw.steps)) return raw
  raw.steps = raw.steps.map((st: any) => {
    const n = Number(st?.timerSec)
    if (!Number.isFinite(n) || n <= 0) {
      return { ...st, timerSec: undefined }
    }
    return { ...st, timerSec: n }
  })
  return raw
}

function applyTimerPolicy(recipe: any) {
  if (!Array.isArray(recipe?.steps)) return recipe
  const steps = recipe.steps.map((st: any) => {
    const inst = String(st?.instruction ?? '')
    const s = inst.replace(/\s/g, '')
    const hasTimer = Number.isFinite(Number(st?.timerSec)) && Number(st.timerSec) > 0

    // 시간 텍스트가 있으면 우선 추출
    const extracted = extractTimerFromText(inst)

    // 1) 가열/조리(또는 시간 명시) 아닌 단계 → 타이머 제거
    if (!isCookingStep(inst)) {
      return { ...st, timerSec: extracted ?? undefined }
    }

    // 2) 가열/조리 단계: 우선순위 (문장 추출) > (기존 timerSec) > (기본값)
    let sec: number | undefined = extracted
    if (!sec && hasTimer) sec = Number(st.timerSec)
    if (!sec) sec = defaultSecondsByVerb(inst)

    if (typeof sec === 'number') {
      const clamped = Math.max(10, Math.min(Math.round(sec), 60 * 60))
      return { ...st, timerSec: clamped }
    }
    // 끝까지 못 구하면 제거
    return { ...st, timerSec: undefined }
  })
  return { ...recipe, steps }
}

/* ------------------ 메인 핸들러 ------------------ */
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

    // 1.5) 파싱 전 정리
    json = preSanitizeJson(json)

    // 2) 스키마 검증
    const recipe = RecipeSchema.parse(json)

    // 3) 서버 보정: 재료 type → 타이머 보정(추출/기본값)
    const withTypes = normalizeRecipeTypes({ ...recipe })
    const adjusted = applyTimerPolicy(withTypes)

    // 4) 결과
    return NextResponse.json(adjusted)
  } catch (err: any) {
    console.error('[API ERROR]', err)
    return NextResponse.json({ error: err?.message || '서버 오류' }, { status: 500 })
  }
}
