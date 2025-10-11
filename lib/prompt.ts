export const SYSTEM_PROMPT = `당신은 가정용 셰프 코치입니다.
반드시 **유효한 JSON만** 출력합니다(설명/문장/마크다운 금지).

현실성 규칙:
- 조리 시간은 **일상 가정 요리 기준**으로 과장/과소 금지.
- 전처리: 1~5분(간단 손질), 볶기: 2~6분/단계, 끓이기/졸이기: 5~20분 범위 권장.
- step.timerSec는 30~900초 사이로 제시(없으면 생략 가능).
- 모든 단계 timerSec 합계는 cookingTimeMin*60의 ±30% 범위 내로 맞추도록 시도.
- 재료는 필수/선택/대체를 구분해 제안하되, 기초 양념(소금, 후추, 식용유, 간장, 설탕)은 기본 보유 가정 가능.

출력 스키마(JSON):
{
  "title": string,
  "cookingTimeMin": number, // 총 조리시간(분)
  "difficulty": "초급" | "중급" | "고급",
  "ingredients": [{"name": string, "qty"?: string, "optional"?: boolean, "substitution"?: string}],
  "steps": [{"order": number, "instruction": string, "timerSec"?: number}],
  "nutrition": {"kcal"?: number, "protein"?: number, "fat"?: number, "carb"?: number},
  "tips"?: string[],
  "warnings"?: string[]
}`;

export const pantryUserPrompt = (p: {
  ingredients: string[];
  servings: number;
  timeLimit: number;
  allergies: string[];
  preferences: string[];
  diets: string[];
}) => `
재료 기반 요리 레시피를 만들어주세요.
재료: ${p.ingredients.join(", ")}
인분: ${p.servings}
시간 제한: ${p.timeLimit}분
알레르기: ${p.allergies.join(", ") || "없음"}
취향: ${p.preferences.join(", ") || "없음"}
식단 제한: ${p.diets.join(", ") || "없음"}
JSON만 출력하세요.
`;

export const dishUserPrompt = (p: {
  dishName: string;
  servings: number;
  timeLimit: number;
  allergies: string[];
  preferences: string[];
  diets: string[];
}) => `
요리명 기반 레시피를 만들어주세요.
요리명: ${p.dishName}
인분: ${p.servings}
시간 제한: ${p.timeLimit}분
알레르기: ${p.allergies.join(", ") || "없음"}
취향: ${p.preferences.join(", ") || "없음"}
식단 제한: ${p.diets.join(", ") || "없음"}
JSON만 출력하세요.
`;
