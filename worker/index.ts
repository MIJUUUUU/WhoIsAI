// @ts-expect-error - .open-next/worker.js는 `opennextjs-cloudflare build` 실행 후에만 존재한다.
import { default as nextHandler } from '../.open-next/worker.js';
import type { Env } from './types';
import { GameRoomDO } from './gameRoomDO';
import { LobbyRegistryDO } from './lobbyRegistryDO';
import { fetchLeaderboard } from './appwrite';

export { GameRoomDO, LobbyRegistryDO };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외

function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function gameRoomStub(env: Env, roomId: string) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));
}

function lobbyStub(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName('global-lobby'));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 방 하나 = Durable Object 하나. /ws/:roomId 로 WebSocket 업그레이드 요청을 그 방으로 라우팅한다.
    if (pathname.startsWith('/ws/')) {
      const roomId = pathname.slice('/ws/'.length).toUpperCase();
      if (!roomId) return new Response('room id required', { status: 400 });
      return gameRoomStub(env, roomId).fetch(request);
    }

    if (pathname === '/api/lobby' && request.method === 'GET') {
      const rooms = await lobbyStub(env).listRooms();
      return json(rooms);
    }

    if (pathname === '/api/leaderboard' && request.method === 'GET') {
      const rows = await fetchLeaderboard(env);
      return json(rows);
    }

    if (pathname === '/api/rooms' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body.jwt || typeof body.jwt !== 'string') {
        return json({ ok: false, error: '로그인 후 이용할 수 있습니다.' }, 401);
      }
      const roomId = generateRoomCode();
      const result = await gameRoomStub(env, roomId).createRoom({
        roomId,
        name: body.name,
        isPublic: body.isPublic,
        maxPlayers: body.maxPlayers,
        jwt: body.jwt,
      });
      if (result?.error) return json({ ok: false, error: result.error }, 400);
      return json({ ok: true, roomId, playerId: result.playerId, nickname: result.nickname });
    }

    const joinMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (joinMatch && request.method === 'POST') {
      const roomId = joinMatch[1].toUpperCase();
      const body = await readJson(request);
      if (!body.jwt || typeof body.jwt !== 'string') {
        return json({ ok: false, error: '로그인 후 이용할 수 있습니다.' }, 401);
      }
      const result = await gameRoomStub(env, roomId).joinRoom({ jwt: body.jwt });
      if (result?.error) return json({ ok: false, error: result.error }, 400);
      return json({ ok: true, roomId, playerId: result.playerId, nickname: result.nickname });
    }

    // 그 외 전부 Next.js(OpenNext)로 위임
    return nextHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
