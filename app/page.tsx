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
   서버가 type을 안 보낼 때 안전하게 표시
========================================= */

// 기본적으로 집에 있을 법한 조미료/기름/향신료/물 등
const BASIC_OPTIONALS = new Set([
  '소금','후추','식용유','올리브유','카놀라유','버터','마가린',
  '참기름','식초','설탕','꿀','간장','고춧가루','고추장','된장',
  '다진마늘','마늘','물','전분','밀가루','옥수수전분',
  '파','대파','쪽파'
])

type AnyIng = {
  name: string
  qty?: string
  optional?: boolean
  substitution?: string
} & Record<string, any>

/** 서버 type > optional > substitution > 기본조미료 > 필수 */
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

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('pantry')

  // 입력 상태
  const [ingredientsText, setIngredientsText] = useState('계란 2개, 양파 1/2, 남은 김치 조금')
  const [dishName, setDishName] = useState('김치볶음밥')
  const [servings, setServings] = useState(2)
  const [timeLimit, setTimeLimit] = useState(20)
  const [allergiesText, setAllergiesText] = useState('')
  const [prefsText, setPrefsText] = useState('아이친화, 맵지 않게')
  const [dietsText, setDietsText] = useState('')

  // 상태
  const [loading, setLoading] = useState(false)       // 레시피 생성 로딩
  const [suggesting, setSuggesting] = useState(false) // 추천 로딩
  const [error, setError] = useState<string | null>(null)

  // 탭별 레시피 저장 → 탭 이동해도 유지
  const [pantryRecipe, setPantryRecipe] = useState<Recipe | null>(null)
  const [dishRecipe, setDishRecipe] = useState<Recipe | null>(null)
  const currentRecipe = mode === 'pantry' ? pantryRecipe : dishRecipe

  // 추천 목록 + 클릭 피드백
  const [suggests, setSuggests] = useState<Suggest[]>([])
  const [clickedIndex, setClickedIndex] = useState<number | null>(null)

  // 탭 전환: 레시피는 유지, 에러/추천만 정리
  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuggests([])
    setClickedIndex(null)
  }

  // 공통 레시피 생성: storeAs 로 저장 위치 고정 가능
  async function generateRecipe(body: any, storeAs: 'pantry' | 'dish' = (body.mode as 'pantry' | 'dish')) {
    setLoading(true)
    setError(null)
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
    } catch (err: any) {
      setError(err?.message || '요청 실패')
    } finally {
      setLoading(false)
    }
  }

  // 폼 제출: dish는 바로 생성, pantry는 추천 먼저 띄움(안전망)
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

  // 메인 버튼: pantry=추천 호출 / dish=레시피 생성
  async function handleMainButton() {
    if (mode === 'pantry') {
      await handleSuggest()
    } else {
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

  // 추천 호출 (pantry 전용 UX)
  async function handleSuggest() {
    setSuggests([])
    setClickedIndex(null)
    setError(null)
    setSuggesting(true)
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
    } catch (err: any) {
      setError(err?.message || '추천 실패')
    } finally {
      setSuggesting(false)
    }
  }

  // 추천 클릭 → 탭은 그대로(재료), 자동 생성하되 결과는 pantry 쪽에 저장
  async function chooseSuggestion(idx: number) {
    const item = suggests[idx]
    if (!item) return
    setClickedIndex(idx)

    setTimeout(async () => {
      setDishName(item.nameKo) // 기록용
      await generateRecipe({
        mode: 'dish',                 // 요리명 기반으로 생성
        dishName: item.nameKo,
        servings,
        timeLimit,
        allergies: splitList(allergiesText),
        preferences: splitList(prefsText),
        diets: splitList(dietsText),
      }, 'pantry')                    // 결과는 pantry 슬롯에 저장/표시
    }, 150)
  }

  // 공유
  function handleShare(recipe: Recipe | null) {
    if (!recipe) return
    const text =
      '오늘의 레시피: ' + recipe.title +
      ' (' + String(recipe.cookingTimeMin) + '분, 난이도 ' + String(recipe.difficulty) + ')'
    if (navigator.share) {
      navigator.share({ title: 'AI 요리비서', text, url: location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => alert('복사되었습니다')).catch(() => {})
    }
  }

  return (
    <main className="space-y-6">
      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => switchMode('pantry')}
          className={'px-3 py-2 rounded-lg border ' + (mode === 'pantry' ? 'bg-black text-white' : 'bg-white')}
          type="button"
        >
          재료로 찾기
        </button>
        <button
          onClick={() => switchMode('dish')}
          className={'px-3 py-2 rounded-lg border ' + (mode === 'dish' ? 'bg-black text-white' : 'bg-white')}
          type="button"
        >
          요리명으로 찾기
        </button>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'pantry' ? (
          <div>
            <label className="block text-sm font-medium mb-1">냉장고 재료 (쉼표 또는 줄바꿈으로 구분)</label>
            <textarea
              value={ingredientsText}
              onChange={e => setIngredientsText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border p-2"
              placeholder="예) 달걀, 양파, 김치"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">요리명</label>
            <input
              value={dishName}
              onChange={e => setDishName(e.target.value)}
              className="w-full rounded-lg border p-2"
              placeholder="예) 부리또, 비빔밥"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">인분</label>
            <input
              type="number"
              min={1}
              value={servings}
              onChange={e => setServings(parseInt(e.target.value || '1'))}
              className="w-full rounded-lg border p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">최대 조리시간(분)</label>
            <input
              type="number"
              min={5}
              value={timeLimit}
              onChange={e => setTimeLimit(parseInt(e.target.value || '5'))}
              className="w-full rounded-lg border p-2"
            />
          </div>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">알레르기 (쉼표/줄바꿈)</label>
            <input
              value={allergiesText}
              onChange={e => setAllergiesText(e.target.value)}
              className="w-full rounded-lg border p-2"
              placeholder="예) 땅콩, 갑각류"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">취향 (예: 매운맛 선호, 아이친화)</label>
            <input
              value={prefsText}
              onChange={e => setPrefsText(e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">식단 제한 (예: 다이어트, 채식)</label>
            <input
              value={dietsText}
              onChange={e => setDietsText(e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>
        </div>

        {/* 메인 버튼: pantry=추천 호출 / dish=레시피 생성 */}
        <button
          type="button"
          onClick={handleMainButton}
          disabled={loading || suggesting}
          className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60"
        >
          {mode === 'pantry'
            ? (suggesting ? '추천 불러오는 중…' : 'AI 레시피 찾기')
            : (loading ? '생성 중…' : 'AI 레시피 찾기')}
        </button>
      </form>

      {/* 오류 */}
      {error && <div className="p-3 border border-red-200 text-red-700 rounded">{error}</div>}

      {/* 추천 목록 (pantry일 때만 노출) */}
      {mode === 'pantry' && suggests.length > 0 && (
        <div className="p-3 border rounded space-y-2">
          <h3 className="font-semibold">추천 메뉴 (클릭하면 자동으로 레시피 생성)</h3>
          <ul className="space-y-2">
            {suggests.map((s, i) => (
              <li
                key={i}
                className={
                  'flex items-center justify-between p-2 border rounded transition ' +
                  (clickedIndex === i ? 'scale-95 ring-2 ring-emerald-500' : 'hover:bg-neutral-50')
                }
              >
                <div>
                  <div className="font-medium">{s.nameKo}</div>
                  <div className="text-xs text-neutral-600">{s.nameEn}</div>
                </div>
                <button
                  onClick={() => chooseSuggestion(i)}
                  className="px-3 py-1 rounded border"
                >
                  이 메뉴로
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 현재 탭 레시피만 표시 */}
      {currentRecipe && (
        <RecipeView
          key={mode + ':' + (currentRecipe?.title ?? '')}
          recipe={currentRecipe}
          onShare={() => handleShare(currentRecipe)}
          onReset={() => {
            if (mode === 'pantry') setPantryRecipe(null)
            else setDishRecipe(null)
          }}
        />
      )}
    </main>
  )
}

function RecipeView({ recipe, onShare, onReset }: { recipe: Recipe; onShare: () => void; onReset: () => void }) {
  // 현재 단계 하이라이트 + 네비게이션
  const [currentStep, setCurrentStep] = useState(0)
  const total = recipe.steps.length

  function prevStep() { setCurrentStep(s => Math.max(0, s - 1)) }
  function nextStep() { setCurrentStep(s => Math.min(total - 1, s + 1)) }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{recipe.title}</h2>
          <p className="text-sm text-neutral-600">
            {'조리시간 ' + (recipe.cookingTimeMin ?? 0) + '분 · 난이도 ' + recipe.difficulty}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onShare} className="px-3 py-2 rounded border">공유</button>
          <button onClick={() => window.print()} className="px-3 py-2 rounded border">인쇄</button>
          <button onClick={onReset} className="px-3 py-2 rounded border">다시 찾기</button>
        </div>
      </div>

      {/* 재료: inferType로 라벨 보정 */}
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
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${badgeClass}`}>
                  {t}
                </span>
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

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">조리 단계</h3>
        <div className="flex gap-2">
          <button onClick={prevStep} className="px-3 py-1 border rounded" disabled={currentStep === 0}>이전 단계</button>
          <span className="text-sm self-center">{currentStep + 1} / {total}</span>
          <button onClick={nextStep} className="px-3 py-1 border rounded" disabled={currentStep === total - 1}>다음 단계</button>
        </div>
      </div>

      <ol className="list-decimal ml-6 space-y-2">
        {recipe.steps.map((s, i) => (
          <li
            key={s.order}
            className={
              'space-y-1 p-2 rounded border ' +
              (i === currentStep ? 'border-emerald-400 bg-emerald-50/40' : 'border-transparent')
            }
          >
            <p>{s.instruction}</p>
            {typeof s.timerSec === 'number' && s.timerSec > 0 && (
              <StepTimer seconds={s.timerSec} />
            )}
          </li>
        ))}
      </ol>

      {(recipe.warnings?.length ?? 0) > 0 && (
        <div className="p-3 rounded bg-amber-50 border border-amber-200">
          <h4 className="font-semibold mb-1">안전 주의</h4>
          <ul className="list-disc ml-6 text-sm space-y-1">
            {recipe.warnings!.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

// 타이머: 시작/일시정지/재개/초기화 + 진행률 (🔕 소리 없음)
function StepTimer({ seconds }: { seconds: number }) {
  const [remain, setRemain] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle'|'running'|'paused'|'done'>('idle')

  // tick
  useEffect(() => {
    if (status !== 'running' || remain === null || remain <= 0) return
    const id = setInterval(() => {
      setRemain(r => {
        const next = (r ?? 0) - 1
        if (next <= 0) {
          clearInterval(id)
          setStatus('done')
          alert('타이머 종료!')
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [status, remain])

  // controls
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
      <div className="flex items-center gap-2">
        {status === 'idle' && <button onClick={start} className="px-2 py-1 text-sm border rounded">시작</button>}
        {status === 'running' && (
          <>
            <button onClick={pause} className="px-2 py-1 text-sm border rounded">일시정지</button>
            <button onClick={reset} className="px-2 py-1 text-sm border rounded">초기화</button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button onClick={resume} className="px-2 py-1 text-sm border rounded">재개</button>
            <button onClick={reset} className="px-2 py-1 text-sm border rounded">초기화</button>
          </>
        )}
        {status === 'done' && (
          <>
            <button onClick={start} className="px-2 py-1 text-sm border rounded">다시 시작</button>
            <button onClick={reset} className="px-2 py-1 text-sm border rounded">초기화</button>
          </>
        )}
        <span className="text-sm tabular-nums">남은시간: {left}s</span>
      </div>

      {/* 진행률 바 */}
      <div className="h-2 w-full bg-neutral-200 rounded">
        <div
          className="h-2 rounded bg-emerald-500 transition-all"
          style={{ width: percent + '%' }}
        />
      </div>
    </div>
  )
}
