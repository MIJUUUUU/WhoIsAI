// 게임 상태 타입은 worker/types.ts(서버) 쪽 정의를 그대로 재사용한다 (타입 전용 import라 번들에는 포함되지 않음).
export type {
  GamePhase,
  PlayerView,
  ChatMessage,
  RoomStateView as RoomState,
  LobbyRoomSummary,
  RoundResultPayload,
  GameOverPayload,
  VoteProgressPayload,
  ServerMessage,
  ClientMessage,
} from '@/worker/types';

// 값(런타임 상수) — 서버/클라 UI가 같은 값을 쓰도록 공유.
export { MIN_PLAYERS_TO_START } from '@/worker/types';

export interface AckResponse {
  ok: boolean;
  error?: string;
  roomId?: string;
  playerId?: string;
  nickname?: string;
}
