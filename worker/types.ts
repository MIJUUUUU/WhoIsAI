export interface Env {
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  AI_MODEL: string;
  DISCUSSION_MS?: string;
  VOTING_MS?: string;
  ROUND_RESULT_MS?: string;
  MAX_ROUNDS?: string;
  APPWRITE_ENDPOINT: string;
  APPWRITE_PROJECT_ID: string;
  APPWRITE_DATABASE_ID: string;
  APPWRITE_STATS_TABLE_ID: string;
  APPWRITE_API_KEY: string;
}

// 서버(GameRoomDO)와 클라이언트(대기실 UI) 둘 다에서 쓰는 공유 상수라 여기 둔다 (cloudflare:workers 의존성 없음).
export const MIN_PLAYERS_TO_START = 3;

export type GamePhase = 'LOBBY' | 'DISCUSSION' | 'VOTING' | 'ROUND_RESULT' | 'GAME_OVER';

export interface Player {
  id: string;
  nickname: string;
  // 게임 시작 시 nickname이 "1번/2번..."으로 덮어써지므로, 전적 기록에 쓸 계정 고정 닉네임을 따로 보관.
  lobbyNickname: string;
  isAI: boolean;
  isAlive: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  // 마지막으로 뭐든(hello/ping/채팅/투표 등) 메시지를 보낸 시각. 소켓이 정상 종료 신호 없이
  // 그냥 조용히 죽었을 때(노트북 잠자기, 네트워크 끊김 등)를 감지하는 데 쓴다.
  lastSeenAt: number | null;
  // AI가 직접 언급되거나(mention) 대화에 반응해서 끼어들 때(reactive) 공유하는 쿨다운 기준 시각.
  lastReactiveReplyAt: number | null;
  // AI가 실제로 마지막 메시지를 보낸 시각(AI 전용). 스케줄 발화와 반응형 발화가 우연히 겹쳐서
  // 연달아 두 번 말하는 걸 막는 최소 간격 체크에 쓴다.
  lastMessageAt?: number | null;
  // 대기실에서 게임 시작 준비가 됐는지 (방장은 체크하지 않음).
  isReady: boolean;
  // 채팅 도배 방지: 최근에 보낸 메시지 시각들, 그리고 도배로 걸렸을 때 풀리는 시각.
  recentChatTimestamps?: number[];
  mutedUntil?: number | null;
  // 비속어 사용 누적 횟수. PROFANITY_KICK_LIMIT회 채우면 강제 퇴장.
  profanityStrikes?: number;
  // 로그인된 경우에만 채워짐. 다른 플레이어에게는 절대 노출하지 않고 전적 기록에만 쓴다.
  appwriteUserId?: string;
  appwriteDisplayName?: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  ts: number;
}

export interface DiscussionTopic {
  title: string;
  question: string;
}

// AI가 캐물어도 일관되게 답할 수 있도록 게임 시작 시 한 번 뽑아 게임 내내 유지하는 가짜 신상.
export interface AiPersona {
  age: number;
  job: string;
  mbti: string;
  recentEvent: string;
}

export interface RoomData {
  id: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  hostId: string | null;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number | null;
  winner: 'HUMANS' | 'AI' | null;
  players: Player[];
  chatLog: ChatMessage[];
  votes: Record<string, string>;
  revealed: string[];
  createdAt: number;
  // 게임 시작 시 한 번 뽑혀서 게임 내내 유지되는 대화 주제 (로비에서는 없음).
  topic: DiscussionTopic | null;
  // 게임 시작 시 한 번 뽑혀서 게임 내내 유지되는 AI의 가짜 신상 (로비에서는 없음).
  aiPersona: AiPersona | null;
  // 이 방에서 강퇴(방장 강퇴, 비속어 누적 등)당한 적 있는 계정의 Appwrite 유저 ID 목록.
  // 재입장을 막기 위해 방이 존재하는 한 계속 유지한다.
  kickedUserIds: string[];
  // 게임 진행 중에 직접 나간 계정의 Appwrite 유저 ID -> 재입장 가능해지는 시각(ms).
  rejoinBlockedUntil: Record<string, number>;
}

export type ScheduledEventType =
  | 'DISCUSSION_END'
  | 'VOTING_END'
  | 'ROUND_ADVANCE'
  | 'AI_MESSAGE'
  | 'AI_REACTIVE_REPLY'
  | 'DISCONNECT_GRACE';

export interface ScheduledEvent {
  id: string;
  type: ScheduledEventType;
  dueAt: number;
  payload?: Record<string, unknown>;
}

export interface LobbyRoomSummary {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
}

export interface PlayerView {
  id: string;
  nickname: string;
  isAlive: boolean;
  connected: boolean;
  isHost: boolean;
  isReady: boolean;
  isAI?: boolean; // 탈락 공개 또는 게임 종료 전에는 서버가 아예 내려주지 않음
}

// 클라이언트로 내려주는 방 상태: isAI는 탈락 공개/게임종료 전까지 절대 포함하지 않는다.
export interface RoomStateView {
  id: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  hostId: string | null;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number | null;
  winner: 'HUMANS' | 'AI' | null;
  players: PlayerView[];
  chatLog: ChatMessage[];
  topic: DiscussionTopic | null;
}

export interface RoundResultPayload {
  round: number;
  tie: boolean;
  eliminatedId: string | null;
  eliminatedNickname: string | null;
  eliminatedIsAI: boolean | null;
  voteCounts: Record<string, number>;
}

export interface GameOverPayload {
  winner: 'HUMANS' | 'AI';
  players: Array<{ id: string; nickname: string; isAI: boolean; isAlive: boolean }>;
}

export interface VoteProgressPayload {
  voted: number;
  total: number;
}

// 서버 -> 클라이언트 WebSocket 메시지 봉투
export type ServerMessage =
  | { type: 'room:state'; payload: RoomStateView }
  | { type: 'chat:new'; payload: ChatMessage }
  | { type: 'vote:progress'; payload: VoteProgressPayload }
  | { type: 'game:roundResult'; payload: RoundResultPayload }
  | { type: 'game:over'; payload: GameOverPayload }
  | { type: 'kicked'; payload: { reason: string } }
  | { type: 'chat:muted'; payload: { mutedUntil: number } }
  | { type: 'chat:warning'; payload: { count: number; limit: number } }
  | { type: 'error'; payload: { message: string } };

// 클라이언트 -> 서버 WebSocket 메시지 봉투
export type ClientMessage =
  | { type: 'hello'; playerId: string }
  | { type: 'chat:send'; text: string }
  | { type: 'vote:cast'; targetId: string }
  | { type: 'game:start' }
  | { type: 'player:ready'; ready: boolean }
  | { type: 'player:kick'; targetId: string }
  | { type: 'leave' }
  | { type: 'return_to_lobby' }
  | { type: 'ping' };
