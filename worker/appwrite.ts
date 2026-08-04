import type { Env } from './types';

export interface AppwriteIdentity {
  id: string;
  name: string;
  // 계정에 고정 배정된 방 안 닉네임 (형용사+동물 스타일). 처음 로그인이면 아직 없을 수 있다.
  nickname?: string;
}

// 클라이언트가 보낸 JWT가 실제 로그인된 Appwrite 유저의 것인지 REST로 확인한다.
// node-appwrite SDK는 Workers 런타임과 호환되지 않아 fetch로 REST API를 직접 호출한다.
export async function verifyAppwriteJwt(env: Env, jwt: string): Promise<AppwriteIdentity | null> {
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID) return null;
  try {
    const res = await fetch(`${env.APPWRITE_ENDPOINT}/account`, {
      headers: {
        'X-Appwrite-Project': env.APPWRITE_PROJECT_ID,
        'X-Appwrite-JWT': jwt,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      $id: string;
      name?: string;
      email?: string;
      prefs?: { nickname?: string };
    };
    return { id: data.$id, name: data.name || data.email || '플레이어', nickname: data.prefs?.nickname };
  } catch (err) {
    console.error('[appwrite] JWT 검증 실패:', (err as Error).message);
    return null;
  }
}

async function logIfNotOk(label: string, res: Response) {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  console.error(`[appwrite] ${label} 실패 (${res.status}): ${body.slice(0, 300)}`);
}

// 처음 로그인한 유저에게 배정된 닉네임을 계정에 영구 저장한다 (Users API, 서버 API 키 전용).
export async function assignPersistentNickname(env: Env, userId: string, nickname: string): Promise<void> {
  try {
    const res = await fetch(`${env.APPWRITE_ENDPOINT}/users/${userId}/prefs`, {
      method: 'PATCH',
      headers: {
        'X-Appwrite-Project': env.APPWRITE_PROJECT_ID,
        'X-Appwrite-Key': env.APPWRITE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefs: { nickname } }),
    });
    await logIfNotOk('닉네임 저장', res);
  } catch (err) {
    console.error('[appwrite] 닉네임 저장 실패:', (err as Error).message);
  }
}

function statsBase(env: Env): string | null {
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_DATABASE_ID || !env.APPWRITE_STATS_TABLE_ID) return null;
  return `${env.APPWRITE_ENDPOINT}/tablesdb/${env.APPWRITE_DATABASE_ID}/tables/${env.APPWRITE_STATS_TABLE_ID}`;
}

function nicknamesBase(env: Env): string | null {
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_DATABASE_ID || !env.APPWRITE_NICKNAMES_TABLE_ID) return null;
  return `${env.APPWRITE_ENDPOINT}/tablesdb/${env.APPWRITE_DATABASE_ID}/tables/${env.APPWRITE_NICKNAMES_TABLE_ID}`;
}

export async function claimNickname(env: Env, userId: string, nickname: string): Promise<{ ok: boolean; error?: string }> {
  const base = nicknamesBase(env);
  if (!base) return { ok: false, error: '닉네임 저장 설정이 되어 있지 않습니다.' };
  try {
    const query = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'nickname', values: [nickname] }));
    const existingRes = await fetch(`${base}/rows?queries[]=${query}`, { headers: serverHeaders(env) });
    if (!existingRes.ok) return { ok: false, error: '닉네임을 확인할 수 없습니다.' };
    const existing = (await existingRes.json()) as { rows?: Array<{ $id?: string; userId?: string }>; documents?: Array<{ $id?: string; userId?: string }> };
    const rows = existing.rows ?? existing.documents ?? [];
    if (rows.some((row) => row.userId !== userId)) return { ok: false, error: '이미 존재하는 닉네임입니다.' };
    if (rows.length > 0) return { ok: true };
    const createRes = await fetch(`${base}/rows`, {
      method: 'POST', headers: serverHeaders(env),
      body: JSON.stringify({ rowId: userId, data: { nickname, userId }, permissions: ['read("any")'] }),
    });
    if (createRes.status === 409) return { ok: false, error: '이미 존재하는 닉네임입니다.' };
    if (!createRes.ok) return { ok: false, error: '닉네임 저장에 실패했습니다.' };
    return { ok: true };
  } catch (err) {
    console.error('[appwrite] 닉네임 예약 실패:', (err as Error).message);
    return { ok: false, error: '닉네임을 확인할 수 없습니다.' };
  }
}

function serverHeaders(env: Env): Record<string, string> {
  return {
    'X-Appwrite-Project': env.APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': env.APPWRITE_API_KEY,
    'Content-Type': 'application/json',
  };
}

// 게임 종료 시 로그인된 플레이어의 전적을 서버 API 키로만 기록한다 (클라이언트는 절대 직접 못 씀).
export async function recordGameResult(env: Env, userId: string, displayName: string, won: boolean): Promise<void> {
  const base = statsBase(env);
  if (!base) return;
  const headers = serverHeaders(env);

  try {
    // row가 없으면 생성 (있으면 409 conflict -> 정상, 무시)
    const createRes = await fetch(`${base}/rows`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rowId: userId,
        data: { displayName, gamesPlayed: 0, wins: 0, losses: 0 },
        permissions: ['read("any")'],
      }),
    });
    if (!createRes.ok && createRes.status !== 409) await logIfNotOk('row 생성', createRes);

    const gamesPlayedRes = await fetch(`${base}/rows/${userId}/gamesPlayed/increment`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ value: 1 }),
    });
    await logIfNotOk('gamesPlayed 증가', gamesPlayedRes);

    const outcomeRes = await fetch(`${base}/rows/${userId}/${won ? 'wins' : 'losses'}/increment`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ value: 1 }),
    });
    await logIfNotOk(won ? 'wins 증가' : 'losses 증가', outcomeRes);

    const updateRes = await fetch(`${base}/rows/${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ data: { displayName, lastPlayedAt: new Date().toISOString() } }),
    });
    await logIfNotOk('displayName/lastPlayedAt 갱신', updateRes);
  } catch (err) {
    console.error('[appwrite] 전적 기록 실패:', (err as Error).message);
  }
}

export async function fetchLeaderboard(env: Env, limit = 20): Promise<unknown[]> {
  const base = statsBase(env);
  if (!base) return [];
  try {
    // Appwrite 쿼리는 Query 빌더가 만드는 JSON 형태({"method":...})여야 한다 (사람이 읽는 함수-호출 문자열 아님).
    const queries = [
      { method: 'orderDesc', attribute: 'wins' },
      { method: 'limit', values: [limit] },
    ];
    const qs = queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join('&');
    const res = await fetch(`${base}/rows?${qs}`, {
      headers: { 'X-Appwrite-Project': env.APPWRITE_PROJECT_ID, 'X-Appwrite-Key': env.APPWRITE_API_KEY },
    });
    if (!res.ok) {
      await logIfNotOk('리더보드 조회', res);
      return [];
    }
    const data = (await res.json()) as { rows?: unknown[]; documents?: unknown[] };
    return data.rows ?? data.documents ?? [];
  } catch (err) {
    console.error('[appwrite] 리더보드 조회 실패:', (err as Error).message);
    return [];
  }
}
