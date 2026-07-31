import { DurableObject } from 'cloudflare:workers';
import type { Env, LobbyRoomSummary } from './types';

// 싱글턴 DO: 공개방 목록만 들고 있는다. GameRoomDO가 상태 바뀔 때마다 RPC로 등록/해제한다.
export class LobbyRegistryDO extends DurableObject<Env> {
  rooms: Map<string, LobbyRoomSummary> = new Map();
  private loaded: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.loaded = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Record<string, LobbyRoomSummary>>('rooms');
      this.rooms = new Map(Object.entries(stored ?? {}));
    });
  }

  async upsertRoom(summary: LobbyRoomSummary) {
    await this.loaded;
    if (summary.phase === 'GAME_OVER') {
      this.rooms.delete(summary.id);
    } else {
      this.rooms.set(summary.id, summary);
    }
    await this.persist();
    return { ok: true };
  }

  async removeRoom(roomId: string) {
    await this.loaded;
    this.rooms.delete(roomId);
    await this.persist();
    return { ok: true };
  }

  async listRooms(): Promise<LobbyRoomSummary[]> {
    await this.loaded;
    return [...this.rooms.values()].sort((a, b) => b.playerCount - a.playerCount);
  }

  private async persist() {
    await this.ctx.storage.put('rooms', Object.fromEntries(this.rooms));
  }
}
