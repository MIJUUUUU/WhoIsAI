// 아주 흔한 한국어 비속어/욕설과 자음 축약형을 다루는 필터.
const PROFANITY_WORDS = [
  '시발', '씨발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ',
  '병신', 'ㅂㅅ',
  '개새끼', '개새', 'ㄱㅅㄲ', '개년', '개놈', '새끼', 'ㅅㄲ',
  '좆', '좇',
  '존나', '존니', '조낸',
  '지랄', 'ㅈㄹ',
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
    // 자음 사이 공백/기호를 넣는 우회 입력도 잡는다. 예: "ㅈ ㄹ", "ㅈ.ㄹ"
    const pattern = word
      .split('')
      .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s._-]*');
    const matcher = new RegExp(pattern, 'gi');
    if (matcher.test(censored)) {
      matched = true;
      censored = censored.replace(matcher, (match) =>
        match.replace(/[^\s._-]/g, '*')
      );
    }
  }
  return { censored, matched };
}
