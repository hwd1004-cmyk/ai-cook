'use client'
import React, { useEffect, useState } from 'react'
import type { Recipe } from '@/lib/schema'

type Mode = 'pantry' | 'dish'
type Suggest = { nameKo: string; nameEn: string }

// 입력 유틸
const splitList = (s: string) =>
  s.split(/[\n,]/).map(v => v.trim()).filter(Boolean)

/* =========================================
   재료 라벨 보정기 (프론트 추론)
========================================= */
const BASIC_OPTIONALS = new Set([
  '소금','후추','식용유','올리브유','카놀라유','버터','마가린',
  '참기름','식초','설탕','꿀','간장','고춧가루','고추장','된장',
  '다진마늘','마늘','물','전분','밀가루','옥수수전분','파','대파','쪽파'
])

type AnyIng = {
  name: string
  qty?: string
  optional?: boolean
  substitution?: string
} & Record<string, any>

function inferType(it: AnyIng): '필수'|'선택'|'대체' {
  const t = (it as any).type
  if (t === '필수' || t === '선택' || t === '대체') return t
  if (it.optional) return '선택'
  if (typeof it.substitution === 'string' && it.substitution.trim()) return '대체'
  const key = it.name.replace(/\s/g, '')
  for (const base of BASIC_OPTIONALS) {
    if (key.includes(base)) return '선택'
  }
  return '필수'
}

/* =========================================
   ✨ UI 보조 컴포넌트
========================================= */
function LoadingDots() {
  return (
    <span className="inline-flex gap-1 align-middle">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.2s]" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.1s]" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
    </span>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-200/70 ${className}`} />
}

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('pantry')

  // 입력 상태 (초기값은 데모용)
  const [ingredientsText, setIngredientsText] = useState('계란 2개, 양파 1/2, 남은 김치 조금')
  const [dishName, setDishName] = useState('김치볶음밥')
  const [servings, setServings] = useState(2)
  const [timeLimit, setTimeLimit] = useState(20)
  const [allergiesText, setAllergiesText] = useState('')
  const [prefsText, setPrefsText] = useState('아이친화, 맵지 않게')
  const [dietsText, setDietsText] = useState('')

  // 상태
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 탭별 레시피 저장
  const [pantryRecipe, setPantryRecipe] = useState<Recipe | null>(null)
  const [dishRecipe, setDishRecipe] = useState<Recipe | null>(null)
  const currentRecipe = mode === 'pantry' ? pantryRecipe : dishRecipe

  // 추천 상태
  const [suggests, setSuggests] = useState<Suggest[]>([])
  const [clickedIndex, setClickedIndex] = useState<number | null>(null)

  // 탭 전환
function switchMode(next: Mode) {
  setMode(next)
  setError(null)
  setSuccess(null)
  // ✅ 탭 전환 시 추천 결과는 그대로 유지
  // 필요하다면 탭별로 다른 데이터는 각각 state에서 관리 중이므로 그대로 둠
}


  // 공통 레시피 생성
  async function generateRecipe(body: any, storeAs: 'pantry' | 'dish' = (body.mode as 'pantry'|'dish')) {
    setLoading(true); setError(null); setSuccess(null)
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '서버 오류')

      if (storeAs === 'pantry') {
        setPantryRecipe(data)
        try { localStorage.setItem('ai-cook:last:pantry', JSON.stringify(data)) } catch {}
      } else {
        setDishRecipe(data)
        try { localStorage.setItem('ai-cook:last:dish', JSON.stringify(data)) } catch {}
      }
      setSuccess('레시피를 가져왔어요!')
    } catch (err: any) {
      setError(err?.message || '요청 실패')
    } finally {
      setLoading(false)
    }
  }

  // 제출 (Enter키로도 동작)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'dish') {
      await generateRecipe({
        mode: 'dish',
        dishName: dishName.trim(),
        servings,
        timeLimit,
        allergies: splitList(allergiesText),
        preferences: splitList(prefsText),
        diets: splitList(dietsText),
      }, 'dish')
    } else {
      await handleSuggest()
    }
  }

  // 메인 버튼
  async function handleMainButton() {
    if (mode === 'pantry') await handleSuggest()
    else {
      await generateRecipe({
        mode: 'dish',
        dishName: dishName.trim(),
        servings,
        timeLimit,
        allergies: splitList(allergiesText),
        preferences: splitList(prefsText),
        diets: splitList(dietsText),
      }, 'dish')
    }
  }

  // 추천 호출
  async function handleSuggest() {
    setSuggests([]); setClickedIndex(null)
    setError(null); setSuccess(null); setSuggesting(true)
    try {
      const body = {
        mode: 'pantry' as const,
        ingredients: splitList(ingredientsText),
        servings,
        timeLimit,
        allergies: splitList(allergiesText),
        preferences: splitList(prefsText),
        diets: splitList(dietsText),
        style: 'normal',
      }
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '추천 실패')
      const list = Array.isArray(data?.suggestions) ? data.suggestions : []
      setSuggests(list.slice(0, 5))
      setSuccess('가능한 메뉴를 찾았어요!')
    } catch (err: any) {
      setError(err?.message || '추천 실패')
    } finally {
      setSuggesting(false)
    }
  }

  // 추천 클릭→ dish로 생성하지만 pantry 슬롯에 기록
// 수정본 (탭 간 독립)
async function chooseSuggestion(idx: number) {
  const item = suggests[idx]
  if (!item) return
  setClickedIndex(idx)
  setTimeout(async () => {
    // ✅ 요리명 탭 입력값을 건드리지 않음
    await generateRecipe({
      mode: 'dish',
      dishName: item.nameKo,
      servings,
      timeLimit,
      allergies: splitList(allergiesText),
      preferences: splitList(prefsText),
      diets: splitList(dietsText),
    }, 'pantry') // 결과는 ‘재료로 찾기’ 슬롯에만 저장
  }, 150)
}

  // 공유
  function handleShare(recipe: Recipe | null) {
    if (!recipe) return
    const text = `오늘의 레시피: ${recipe.title} (${String(recipe.cookingTimeMin)}분, 난이도 ${String(recipe.difficulty)})`
    if (navigator.share) {
      navigator.share({ title: 'AI 요리비서', text, url: location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => alert('복사되었습니다')).catch(() => {})
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl md:text-2xl font-semibold text-emerald-800">
            오늘 냉장고로 만든 <span className="text-amber-600">맞춤 레시피</span>
          </h2>
          <p className="text-sm text-neutral-600">
            재료로 찾거나, 요리명으로 바로 생성해보세요. 추천 → 선택 → 단계별 타이머까지 한 번에!
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-4 inline-flex rounded-xl border border-neutral-200 bg-white p-1">
          <button
            onClick={() => switchMode('pantry')}
            className={`px-3 py-1.5 text-sm rounded-lg transition hover:shadow-sm active:scale-[0.99]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300
                        ${mode==='pantry' ? 'bg-emerald-600 text-white shadow' : 'text-neutral-700 hover:bg-emerald-50'}`}
            type="button"
          >
            재료로 찾기
          </button>
          <button
            onClick={() => switchMode('dish')}
            className={`px-3 py-1.5 text-sm rounded-lg transition hover:shadow-sm active:scale-[0.99]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300
                        ${mode==='dish' ? 'bg-emerald-600 text-white shadow' : 'text-neutral-700 hover:bg-emerald-50'}`}
            type="button"
          >
            요리명으로 찾기
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          {mode === 'pantry' ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">냉장고 재료 <span className="text-neutral-500">(쉼표/줄바꿈)</span></label>
              <textarea
                value={ingredientsText}
                onChange={e => setIngredientsText(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="예) 달걀, 양파, 김치"
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">요리명</label>
              <input
                value={dishName}
                onChange={e => setDishName(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="예) 비빔밥, 부리또"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">인분</label>
              <input
                type="number"
                min={1}
                value={servings}
                onChange={e => setServings(parseInt(e.target.value || '1'))}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">최대 조리시간(분)</label>
              <input
                type="number"
                min={5}
                value={timeLimit}
                onChange={e => setTimeLimit(parseInt(e.target.value || '5'))}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">알레르기</label>
              <input
                value={allergiesText}
                onChange={e => setAllergiesText(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="예) 땅콩, 갑각류"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">취향</label>
              <input
                value={prefsText}
                onChange={e => setPrefsText(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="예) 아이친화, 덜 맵게"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-neutral-800">식단 제한</label>
              <input
                value={dietsText}
                onChange={e => setDietsText(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="예) 다이어트, 채식"
              />
            </div>
          </div>

<div className="flex gap-2">
  <button
    type="button"
    onClick={handleMainButton}
    disabled={loading || suggesting}
    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60
               transition active:scale-[0.99] hover:shadow-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    aria-busy={loading || suggesting}
  >
    {mode === 'pantry'
      ? (suggesting
          ? <>추천 불러오는 중 <LoadingDots /></>
          : loading
            ? <>레시피 생성 중 <LoadingDots /></>
            : '추천 불러오기')
      : (loading
          ? <>생성 중 <LoadingDots /></>
          : '레시피 생성')}
  </button>
</div>

          {(error || success) && (
            <div className={`mt-1 text-sm rounded-xl px-3 py-2 border ${error ? 'border-red-200 text-red-700 bg-red-50' : 'border-emerald-200 text-emerald-800 bg-emerald-50'}`}>
              {error || success}
            </div>
          )}
        </form>
      </section>

      {/* 스켈레톤 (추천 로딩 중) */}
      {mode === 'pantry' && suggesting && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-14" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 추천 메뉴 리스트 */}
      {mode === 'pantry' && suggests.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">추천 메뉴</h3>
            <span className="text-xs text-neutral-500">클릭하면 자동으로 레시피 생성</span>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {suggests.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => chooseSuggestion(i)}
                  className={
                    'w-full text-left p-3 rounded-xl border bg-white transition ' +
                    (clickedIndex === i
                      ? 'ring-2 ring-emerald-500'
                      : 'hover:bg-neutral-50 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300')
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 grid place-content-center">🍳</div>
                    <div className="flex-1">
                      <div className="font-medium">{s.nameKo}</div>
                      <div className="text-xs text-neutral-600">{s.nameEn}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full border bg-white">이 메뉴로</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 결과 카드 */}
      {currentRecipe && <RecipeView
        key={mode + ':' + (currentRecipe?.title ?? '')}
        recipe={currentRecipe}
        onShare={() => handleShare(currentRecipe)}
        onReset={() => {
          if (mode === 'pantry') setPantryRecipe(null)
          else setDishRecipe(null)
        }}
      />}
    </div>
  )
}

function RecipeView({ recipe, onShare, onReset }: { recipe: Recipe; onShare: () => void; onReset: () => void }) {
  const [currentStep, setCurrentStep] = useState(0)
  const total = recipe.steps.length

  function prevStep() { setCurrentStep(s => Math.max(0, s - 1)) }
  function nextStep() { setCurrentStep(s => Math.min(total - 1, s + 1)) }

  // 좌측 정보 / 우측 단계로 2단 레이아웃
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Info */}
        <div className="md:w-5/12 w-full space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-emerald-800">{recipe.title}</h2>
            <p className="text-sm text-neutral-600">
              조리시간 {recipe.cookingTimeMin ?? 0}분 · 난이도 {recipe.difficulty}
            </p>
          </div>

          {/* Ingredients */}
          <div>
            <h3 className="font-semibold mb-2">재료</h3>
            <ul className="space-y-2">
              {recipe.ingredients.map((it, idx) => {
                const t = inferType(it as any)
                const badgeClass =
                  t === '필수'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : t === '대체'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-800'
                return (
                  <li key={idx} className="flex items-start gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${badgeClass}`}>{t}</span>
                    <div className="leading-tight">
                      <div className="font-medium">
                        {it.name}{it.qty ? ` — ${it.qty}` : ''}
                      </div>
                      {it.substitution && (
                        <div className="text-xs text-neutral-600">대체: {it.substitution}</div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onShare}
              className="px-3 py-2 rounded-xl border bg-white transition hover:shadow-sm active:scale-[0.99]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              공유
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl border bg-white transition hover:shadow-sm active:scale-[0.99]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              인쇄
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2 rounded-xl border bg-white transition hover:shadow-sm active:scale-[0.99]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              다시 찾기
            </button>
          </div>

          {/* Warnings */}
          {(recipe.warnings?.length ?? 0) > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <h4 className="font-semibold mb-1">안전 주의</h4>
              <ul className="list-disc ml-6 text-sm space-y-1">
                {recipe.warnings!.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Steps */}
        <div className="md:w-7/12 w-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">조리 단계</h3>
            <div className="flex gap-2">
              <button
                onClick={prevStep}
                className="px-3 py-1.5 border rounded-lg bg-white transition hover:shadow-sm active:scale-[0.99]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                disabled={currentStep === 0}
              >
                이전
              </button>
              <span className="text-sm self-center">{currentStep + 1} / {total}</span>
              <button
                onClick={nextStep}
                className="px-3 py-1.5 border rounded-lg bg-white transition hover:shadow-sm active:scale-[0.99]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                disabled={currentStep === total - 1}
              >
                다음
              </button>
            </div>
          </div>

          <ol className="space-y-3">
            {recipe.steps.map((s, i) => (
              <li
                key={s.order}
                className={
                  'space-y-2 p-3 rounded-xl border transition ' +
                  (i === currentStep ? 'border-emerald-300 bg-emerald-50/50' : 'border-neutral-200 bg-white')
                }
              >
                <p className="leading-relaxed">{s.instruction}</p>
                {typeof s.timerSec === 'number' && s.timerSec > 0 && (
                  <StepTimer seconds={s.timerSec} />
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// 타이머: 카드 내부에서 상태/진행률로 피드백
function StepTimer({ seconds }: { seconds: number }) {
  const [remain, setRemain] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle'|'running'|'paused'|'done'>('idle')

  const fmt = (n: number) => {
    const m = Math.floor(n / 60).toString().padStart(2,'0')
    const s = Math.floor(n % 60).toString().padStart(2,'0')
    return `${m}:${s}`
  }

  useEffect(() => {
    if (status !== 'running' || remain === null || remain <= 0) return
    const id = setInterval(() => {
      setRemain(r => {
        const next = (r ?? 0) - 1
        if (next <= 0) {
          clearInterval(id)
          setStatus('done')
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [status, remain])

  function start() {
    if (status === 'idle' || status === 'done') {
      setRemain(seconds)
      setStatus('running')
    }
  }
  function pause() {
    if (status === 'running') setStatus('paused')
  }
  function resume() {
    if (status === 'paused') setStatus('running')
  }
  function reset() {
    setRemain(null)
    setStatus('idle')
  }

  const total = seconds > 0 ? seconds : 1
  const left = remain ?? total
  const percent = Math.max(0, Math.min(100, Math.round((1 - left / total) * 100)))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {status === 'idle' && <button onClick={start} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">시작</button>}
        {status === 'running' && (
          <>
            <button onClick={pause} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">일시정지</button>
            <button onClick={reset} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">초기화</button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button onClick={resume} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">재개</button>
            <button onClick={reset} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">초기화</button>
          </>
        )}
        {status === 'done' && (
          <>
            <span className="px-2 py-1 rounded-lg border bg-emerald-50 text-emerald-700">완료!</span>
            <button onClick={start} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">다시 시작</button>
            <button onClick={reset} className="px-2 py-1 rounded-lg border bg-white transition hover:shadow-sm active:scale-[0.99]">초기화</button>
          </>
        )}
        <span className="ml-auto font-mono tabular-nums">{fmt(left)}</span>
      </div>

      <div className="h-2 w-full rounded bg-neutral-200 overflow-hidden">
        <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: percent + '%' }} />
      </div>
    </div>
  )
}
