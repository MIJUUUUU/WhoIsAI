// 모든 플레이어(사람/AI 구분 없이)에게 "형용사+동물" 조합으로 닉네임을 자동 배정한다.
// 사람이 자유 입력한 닉네임과 AI 전용 이름 풀이 따로 있으면 그 자체로 AI를 구분하는 단서가 될 수 있어서,
// 같은 방식으로 무작위 배정해 구분이 안 되게 한다.
const ADJECTIVES = [
  '용감한', '조용한', '엉뚱한', '날쌘', '촉촉한', '반짝이는', '졸린', '까칠한',
  '수줍은', '당당한', '느긋한', '장난스런', '씩씩한', '새침한', '든든한', '엉성한',
];

const ANIMALS = [
  '바다표범', '사자', '고양이', '여우', '펭귄', '독수리', '다람쥐', '수달',
  '너구리', '고래', '앵무새', '판다', '늑대', '두더지', '부엉이', '토끼',
];

export function generateRandomNickname(takenNicknames: string[] = []): string {
  const taken = new Set(takenNicknames);
  for (let i = 0; i < 30; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const candidate = `${adj}${animal}`;
    if (!taken.has(candidate)) return candidate;
  }
  // 30번 시도해도 다 겹치는 극히 드문 경우의 폴백
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}${Math.floor(Math.random() * 90) + 10}`;
}
