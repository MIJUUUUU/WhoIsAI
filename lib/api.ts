import type { AckResponse, LobbyRoomSummary } from '@/types/game';

async function postJson(url: string, body: unknown): Promise<AckResponse> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as AckResponse;
  } catch {
    return { ok: false, error: '서버에 연결할 수 없습니다.' };
  }
}

export function createRoom(input: {
  name: string;
  isPublic: boolean;
  maxPlayers: number;
}): Promise<AckResponse> {
  return postJson('/api/rooms', input);
}

export function joinRoom(roomId: string): Promise<AckResponse> {
  return postJson(`/api/rooms/${roomId}/join`, {});
}

export async function fetchLobby(): Promise<LobbyRoomSummary[]> {
  try {
    const res = await fetch('/api/lobby');
    if (!res.ok) return [];
    return (await res.json()) as LobbyRoomSummary[];
  } catch {
    return [];
  }
}
