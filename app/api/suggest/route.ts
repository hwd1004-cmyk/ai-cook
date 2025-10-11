import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { AnyInputSchema } from '@/lib/schema'
import { extractJson } from '@/lib/json'

export const runtime = 'nodejs'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Style = 'normal' | 'healthy' | 'premium'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = AnyInputSchema.parse(body)
    const style: Style = (body?.style ?? 'normal') as Style

    const styleGuide =
      style === 'healthy'
        ? '건강식(저염·저칼·영양균형) 스타일'
        : style === 'premium'
        ? '고급 레스토랑 스타일'
        : '일반 대중 요리(누구나 쉽게) 스타일'

    const summary =
      parsed.mode === 'pantry'
        ? `입력 모드: 재료 기반
재료: ${parsed.ingredients.join(', ')}
인분: ${parsed.servings}
최대 조리시간(분): ${parsed.timeLimit}
알레르기: ${parsed.allergies.join(', ') || '없음'}
취향: ${parsed.preferences.join(', ') || '없음'}
식단 제한: ${parsed.diets.join(', ') || '없음'}`
        : `입력 모드: 요리명 기반
요리명: ${body?.dishName ?? ''}
인분: ${parsed.servings}
최대 조리시간(분): ${parsed.timeLimit}
알레르기: ${parsed.allergies.join(', ') || '없음'}
취향: ${parsed.preferences.join(', ') || '없음'}
식단 제한: ${parsed.diets.join(', ') || '없음'}`

    const SYSTEM = `당신은 집밥 메뉴 추천 셰프입니다.
반드시 유효한 JSON만 출력하세요. 설명·문장·마크다운 금지.

출력 스키마(JSON만):
{"suggestions":[{"nameKo":"한글 이름","nameEn":"English Name"}]}

규칙:
- 추천 개수: 1~5개.
- 현실적으로 가능한 요리만(황당 조합 금지).
- 입력된 알레르기/식단/시간 제한을 준수.
- 한국어/영어 병기.
- 재료 기반: 입력 재료 최대 활용. 기본 양념(소금/후추/식용유/간장/설탕 등)은 있다고 가정 가능.
- 요리명 기반: 해당 요리의 변형/유사 메뉴 중심.
- JSON 외 어떤 텍스트도 출력하지 말 것.`

    const USER = `${summary}
요리 추천 스타일: ${style} (${styleGuide})

요청:
- 가능한 메뉴를 1~5개 추천
- 반드시 {"suggestions":[...]} 형태의 JSON만 출력`

    // NOTE: temperature / max_output_tokens 사용하지 않음 (이 모델/엔드포인트 미지원)
    const resp = await client.responses.create({
      model: 'gpt-5-mini',
      input: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: USER },
      ],
    })

    const text = (resp as any).output_text?.trim() || ''
    if (!text) throw new Error('모델 응답이 비어 있습니다.')

    const json = extractJson(text)
    const list = Array.isArray(json?.suggestions) ? json.suggestions : []
    const suggestions = list
      .filter((it: any) => it && typeof it.nameKo === 'string' && typeof it.nameEn === 'string')
      .slice(0, 5)

    if (suggestions.length === 0) throw new Error('추천 결과가 없습니다.')
    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[suggest error]', err?.message)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 400 })
  }
}
