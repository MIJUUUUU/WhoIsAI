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

export type GamePhase = 'LOBBY' | 'DISCUSSION' | 'VOTING' | 'ROUND_RESULT' | 'GAME_OVER';

export interface Player {
  id: string;
  nickname: string;
  isAI: boolean;
  isAlive: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  lastMentionReplyAt: number | null;
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
}

export type ScheduledEventType =
  | 'DISCUSSION_END'
  | 'VOTING_END'
  | 'ROUND_ADVANCE'
  | 'AI_MESSAGE'
  | 'AI_MENTION_REPLY'
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
  | { type: 'error'; payload: { message: string } };

// 클라이언트 -> 서버 WebSocket 메시지 봉투
export type ClientMessage =
  | { type: 'hello'; playerId: string }
  | { type: 'chat:send'; text: string }
  | { type: 'vote:cast'; targetId: string }
  | { type: 'game:start' }
  | { type: 'ping' };
