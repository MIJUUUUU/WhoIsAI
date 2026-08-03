export interface DiscussionTopic {
  title: string;
  question: string;
}

const TOPICS: DiscussionTopic[] = [
  { title: '최애 음식', question: '요즘 제일 자주 시켜먹는 음식이 뭐야?' },
  { title: '여행', question: '가장 가보고 싶은 여행지가 어디야?' },
  { title: 'MBTI', question: '너 MBTI가 뭐야? 성격이랑 잘 맞는 것 같아?' },
  { title: '드라마/영화', question: '요즘 보고 있는 드라마나 영화 있어?' },
  { title: '주말 계획', question: '이번 주말에 뭐 할 계획이야?' },
  { title: '최근 산 물건', question: '최근에 산 것 중에 제일 만족스러운 게 뭐야?' },
  { title: '음악 취향', question: '요즘 제일 많이 듣는 노래나 가수 있어?' },
  { title: '반려동물', question: '반려동물 키워본 적 있어? 어떤 동물 좋아해?' },
  { title: '커피 vs 차', question: '커피파야 차파야?' },
  { title: '취미', question: '요즘 새로 시작했거나 관심 있는 취미 있어?' },
  { title: '아침형 vs 저녁형', question: '아침형 인간이야 저녁형 인간이야?' },
  { title: '최근 고민', question: '요즘 제일 큰 고민이 뭐야? (가벼운 걸로)' },
];

export function pickRandomTopic(): DiscussionTopic {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}
