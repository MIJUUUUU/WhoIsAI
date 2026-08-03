// 아주 흔한 한국어 비속어/욕설만 다루는 단순 치환 필터. 완벽한 탐지가 목표가 아니라
// 명백한 욕설을 가리고 반복 사용을 제재하는 최소한의 장치.
const PROFANITY_WORDS = [
  '시발', '씨발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ',
  '병신', 'ㅂㅅ',
  '개새끼', '개새', '개년', '개놈', '새끼',
  '좆', '좇',
  '존나', '존니', '조낸',
  '지랄',
  '미친놈', '미친년',
  '걸레', '창녀',
  '씹', '느금마', '느검마', '엠창',
  '자지', '보지',
  '섹스', '꺼져', '뒤져',
];

export function censorProfanity(text: string): { censored: string; matched: boolean } {
  let censored = text;
  let matched = false;
  for (const word of PROFANITY_WORDS) {
    if (censored.includes(word)) {
      matched = true;
      censored = censored.split(word).join('*'.repeat(word.length));
    }
  }
  return { censored, matched };
}
