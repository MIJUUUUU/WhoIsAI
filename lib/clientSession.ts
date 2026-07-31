export interface SessionInfo {
  roomId: string;
  playerId: string;
  nickname: string;
}

const key = (roomId: string) => `aiplayer:session:${roomId.toUpperCase()}`;

export function saveSession(info: SessionInfo) {
  try {
    localStorage.setItem(key(info.roomId), JSON.stringify(info));
  } catch {
    // localStorage 사용 불가 환경(사생활 보호 모드 등) - 세션 복구만 못 하고 넘어간다.
  }
}

export function loadSession(roomId: string): SessionInfo | null {
  try {
    const raw = localStorage.getItem(key(roomId));
    return raw ? (JSON.parse(raw) as SessionInfo) : null;
  } catch {
    return null;
  }
}

export function clearSession(roomId: string) {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    // no-op
  }
}
