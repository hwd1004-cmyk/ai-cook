export function extractJson(text: string) {
  if (!text) throw new Error('No text to parse');

  // 1) JSON 전체 블록 위치 찾기
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1) {
    throw new Error('No JSON object found in text');
  }

  // 2) JSON만 잘라내기
  const jsonString = text.slice(first, last + 1);

  // 3) 안전 파싱
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON parsing failed. Original text:', text);
    throw new Error('JSON parse failed');
  }
}
