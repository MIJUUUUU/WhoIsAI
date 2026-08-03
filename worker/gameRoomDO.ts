import { DurableObject } from 'cloudflare:workers';
import {
  MIN_PLAYERS_TO_START,
  type Env,
  type RoomData,
  type Player,
  type ChatMessage,
  type ScheduledEvent,
  type RoomStateView,
  type ServerMessage,
  type ClientMessage,
} from './types';
import { generateRandomNickname } from './names';
import {
  findAiPlayer,
  generateAiMessage,
  randomMessageOffsets,
  shouldTriggerMentionReply,
  shouldTriggerReactiveReply,
  pickAiPersona,
  type ReactingTo,
} from './aiPlayer';
import { verifyAppwriteJwt, recordGameResult, assignPersistentNickname, type AppwriteIdentity } from './appwrite';
import { pickRandomTopic } from './topics';
import { censorProfanity } from './profanity';

const MIN_MAX_PLAYERS = MIN_PLAYERS_TO_START;
const MAX_MAX_PLAYERS = 10;
const DISCONNECT_GRACE_MS = 30000;
const DISCUSSION_MS_DEFAULT = 3 * 60 * 1000;
const VOTING_MS_DEFAULT = 30 * 1000;
const ROUND_RESULT_MS_DEFAULT = 6 * 1000;
const MAX_ROUNDS_DEFAULT = 5;
const CHAT_SPAM_WINDOW_MS = 10 * 1000;
const CHAT_SPAM_LIMIT = 10;
const CHAT_MUTE_MS = 30 * 1000;
const PROFANITY_KICK_LIMIT = 3;
// 클라이언트 ping 주기(15초)보다 넉넉히 커야 정상 연결을 오탐하지 않는다.
// 백그라운드 탭은 브라우저가 타이머를 강하게 스로틀링해서 40초 정도로는 오탐이 났었어서 더 넉넉하게 잡는다.
const STALE_CONNECTION_MS = 90 * 1000;

export class GameRoomDO extends DurableObject<Env> {
  room: RoomData | null = null;
  events: ScheduledEvent[] = [];
  private loaded: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.loaded = ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>('room')) ?? null;
      this.events = (await ctx.storage.get<ScheduledEvent[]>('events')) ?? [];
    });
  }

  private get discussionMs() {
    return Number(this.env.DISCUSSION_MS) || DISCUSSION_MS_DEFAULT;
  }
  private get votingMs() {
    return Number(this.env.VOTING_MS) || VOTING_MS_DEFAULT;
  }
  private get roundResultMs() {
    return Number(this.env.ROUND_RESULT_MS) || ROUND_RESULT_MS_DEFAULT;
  }
  private get maxRounds() {
    return Number(this.env.MAX_ROUNDS) || MAX_ROUNDS_DEFAULT;
  }

  // ---------------- RPC (HTTP 라우트에서 호출) ----------------

  async createRoom(input: { roomId: string; name: string; isPublic: boolean; maxPlayers: number; jwt?: string }) {
    await this.loaded;
    const identity = input.jwt ? await verifyAppwriteJwt(this.env, input.jwt) : null;
    if (!identity) return { error: '로그인 후 이용할 수 있습니다.' };

    const clampedMax = Math.min(
      MAX_MAX_PLAYERS,
      Math.max(MIN_MAX_PLAYERS, Number(input.maxPlayers) || MIN_MAX_PLAYERS)
    );
    const hostId = crypto.randomUUID();
    const nickname = await this.resolveNickname(identity, []);
    const hostPlayer: Player = {
      id: hostId,
      nickname,
      lobbyNickname: nickname,
      isAI: false,
      isAlive: true,
      connected: false,
      disconnectedAt: null,
      lastSeenAt: null,
      lastReactiveReplyAt: null,
      isReady: false,
      appwriteUserId: identity?.id,
      appwriteDisplayName: identity?.name,
    };

    this.room = {
      id: input.roomId,
      name: String(input.name || '').trim().slice(0, 30) || `${nickname}의 방`,
      isPublic: Boolean(input.isPublic),
      maxPlayers: clampedMax,
      hostId,
      phase: 'LOBBY',
      round: 0,
      phaseEndsAt: null,
      winner: null,
      players: [hostPlayer],
      chatLog: [],
      votes: {},
      revealed: [],
      createdAt: Date.now(),
      topic: null,
      aiPersona: null,
      kickedUserIds: [],
    };
    this.events = [];
    await this.persist();
    await this.syncLobby();
    return { playerId: hostId, nickname, room: this.serializeRoom() };
  }

  async joinRoom(input: { jwt?: string } = {}) {
    await this.loaded;
    if (!this.room) return { error: '존재하지 않는 방입니다.' };
    if (this.room.phase !== 'LOBBY') return { error: '이미 게임이 시작된 방입니다.' };

    const identity = input.jwt ? await verifyAppwriteJwt(this.env, input.jwt) : null;
    if (!identity) return { error: '로그인 후 이용할 수 있습니다.' };
    if (this.room.kickedUserIds.includes(identity.id)) {
      return { error: '강퇴당한 방에는 다시 입장할 수 없습니다.' };
    }

    const humanCount = this.room.players.filter((p) => !p.isAI).length;
    if (humanCount >= this.room.maxPlayers) return { error: '방 인원이 가득 찼습니다.' };

    const playerId = crypto.randomUUID();
    const nickname = await this.resolveNickname(
      identity,
      this.room.players.map((p) => p.nickname)
    );
    this.room.players.push({
      id: playerId,
      nickname,
      lobbyNickname: nickname,
      isAI: false,
      isAlive: true,
      connected: false,
      disconnectedAt: null,
      lastSeenAt: null,
      lastReactiveReplyAt: null,
      isReady: false,
      appwriteUserId: identity?.id,
      appwriteDisplayName: identity?.name,
    });
    await this.persist();
    await this.syncLobby();
    this.broadcastState();
    return { playerId, nickname, room: this.serializeRoom() };
  }

  // 로그인된 유저는 계정에 고정된 닉네임을 재사용한다 (처음이면 새로 배정해서 계정에 저장).
  // 이 방 안에서 이미 쓰이고 있는 이름과 겹치면(드문 경우) 이번 판에 한해서만 새로 뽑는다.
  private async resolveNickname(identity: AppwriteIdentity | null, taken: string[]): Promise<string> {
    if (!identity) return generateRandomNickname(taken);
    if (identity.nickname && !taken.includes(identity.nickname)) return identity.nickname;

    const fresh = generateRandomNickname(taken);
    if (!identity.nickname) {
      await assignPersistentNickname(this.env, identity.id, fresh);
    }
    return fresh;
  }

  // ---------------- WebSocket ----------------

  async fetch(request: Request): Promise<Response> {
    await this.loaded;
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, messageData: string | ArrayBuffer) {
    await this.loaded;
    if (!this.room) return;
    await this.checkOverdueTransitions();
    await this.checkStaleConnections();
    if (!this.room) return;

    let msg: ClientMessage;
    try {
      const text = typeof messageData === 'string' ? messageData : new TextDecoder().decode(messageData);
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.type === 'hello') {
      const player = this.room.players.find((p) => p.id === msg.playerId);
      if (!player) {
        this.sendError(ws, '플레이어 정보를 찾을 수 없습니다.');
        return;
      }
      ws.serializeAttachment({ playerId: player.id });
      player.connected = true;
      player.disconnectedAt = null;
      player.lastSeenAt = Date.now();
      this.cancelEventsFor('DISCONNECT_GRACE', player.id);
      await this.persist();
      this.broadcastState();
      return;
    }

    const attachment = ws.deserializeAttachment() as { playerId?: string } | null;
    const playerId = attachment?.playerId;
    if (!playerId) return;
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return;
    // ping을 포함해 뭐든 메시지가 온다는 건 소켓이 살아있다는 뜻이므로 매번 갱신한다.
    player.lastSeenAt = Date.now();

    if (msg.type === 'chat:send') {
      await this.handleChatSend(ws, player, msg.text);
    } else if (msg.type === 'vote:cast') {
      await this.handleVoteCast(ws, player, msg.targetId);
    } else if (msg.type === 'game:start') {
      await this.handleGameStart(ws, player);
    } else if (msg.type === 'player:ready') {
      await this.handlePlayerReady(player, msg.ready);
    } else if (msg.type === 'player:kick') {
      await this.handlePlayerKick(ws, player, msg.targetId);
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.loaded;
    if (!this.room) return;
    const attachment = ws.deserializeAttachment() as { playerId?: string } | null;
    const playerId = attachment?.playerId;
    if (!playerId) return;
    await this.markDisconnected(playerId);
  }

  // 정상적인 close 신호(webSocketClose)로 감지된 경우와, ping이 STALE_CONNECTION_MS 넘게 끊긴
  // 것으로 감지된 경우 둘 다 여기로 모아서 처리한다 (대기실 즉시 퇴장 / 게임 중 유예 후 퇴장).
  private async markDisconnected(playerId: string) {
    if (!this.room) return;
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player || !player.connected) return;

    player.connected = false;
    player.disconnectedAt = Date.now();
    await this.persist();
    this.broadcastState();

    if (this.room.phase === 'LOBBY') {
      // 대기실에서 혼자 있는 상태로 끊기면(백그라운드 탭 스로틀링, 일시적 네트워크 문제 등) 방을
      // 통째로 없애지 않는다 — 금방 재접속해서 돌아올 수도 있고, 어차피 다른 사람이 없어서
      // 유령 상태로 남아있어도 헷갈릴 사람이 없다. 정말 안 돌아오면 그냥 방치될 뿐 피해가 없다.
      const humanCount = this.room.players.filter((p) => !p.isAI).length;
      if (humanCount > 1) await this.removePlayer(playerId);
    } else {
      await this.enqueueEvent({
        id: crypto.randomUUID(),
        type: 'DISCONNECT_GRACE',
        dueAt: Date.now() + DISCONNECT_GRACE_MS,
        payload: { playerId },
      });
    }
  }

  // 소켓이 정상 종료 신호 없이 조용히 죽어서(노트북 잠자기 등) webSocketClose가 안 불릴 수 있으므로,
  // 클라이언트가 15초마다 보내는 ping을 기준으로 STALE_CONNECTION_MS 넘게 아무 신호도 없었으면
  // 끊긴 것으로 간주한다.
  private async checkStaleConnections() {
    if (!this.room) return;
    const now = Date.now();
    const stale = this.room.players.filter(
      (p) => !p.isAI && p.connected && p.lastSeenAt !== null && now - p.lastSeenAt > STALE_CONNECTION_MS
    );
    for (const p of stale) {
      if (!this.room) break;
      await this.markDisconnected(p.id);
    }
  }

  // ---------------- 액션 핸들러 ----------------

  private async handleChatSend(ws: WebSocket, player: Player, rawText: string) {
    if (!this.room) return;
    if (!['LOBBY', 'DISCUSSION'].includes(this.room.phase)) {
      return this.sendError(ws, '지금은 채팅할 수 없습니다.');
    }
    if (!player.isAlive) return this.sendError(ws, '탈락한 플레이어는 채팅할 수 없습니다.');

    const now = Date.now();
    if (player.mutedUntil && now < player.mutedUntil) {
      return this.sendChatMuted(ws, player.mutedUntil);
    }

    // 도배 방지: 최근 CHAT_SPAM_WINDOW_MS 안에 CHAT_SPAM_LIMIT개를 이미 보냈다면 CHAT_MUTE_MS만큼 잠근다.
    player.recentChatTimestamps = (player.recentChatTimestamps ?? []).filter(
      (t) => now - t < CHAT_SPAM_WINDOW_MS
    );
    if (player.recentChatTimestamps.length >= CHAT_SPAM_LIMIT) {
      player.mutedUntil = now + CHAT_MUTE_MS;
      player.recentChatTimestamps = [];
      await this.persist();
      return this.sendChatMuted(ws, player.mutedUntil);
    }
    player.recentChatTimestamps.push(now);

    const text = String(rawText || '').trim().slice(0, 300);
    if (!text) return this.sendError(ws, '메시지를 입력해주세요.');

    const { censored, matched } = censorProfanity(text);
    if (matched) {
      player.profanityStrikes = (player.profanityStrikes ?? 0) + 1;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: player.id,
      nickname: player.nickname,
      text: censored,
      ts: Date.now(),
    };
    this.room.chatLog.push(message);
    if (this.room.chatLog.length > 200) this.room.chatLog = this.room.chatLog.slice(-200);
    await this.persist();
    this.broadcast({ type: 'chat:new', payload: message });

    if (matched && (player.profanityStrikes ?? 0) >= PROFANITY_KICK_LIMIT) {
      await this.kickPlayer(player.id, '비속어를 반복 사용해 강제 퇴장되었습니다.');
      return;
    }
    if (matched) {
      try {
        ws.send(
          JSON.stringify({
            type: 'chat:warning',
            payload: { count: player.profanityStrikes ?? 1, limit: PROFANITY_KICK_LIMIT },
          } satisfies ServerMessage)
        );
      } catch {
        // 이미 끊긴 소켓은 무시
      }
    }

    if (this.room.phase === 'DISCUSSION') {
      const ai = findAiPlayer(this.room);
      if (ai) {
        const now = Date.now();
        const mentioned = shouldTriggerMentionReply(this.room, message, now);
        // 직접 언급된 게 아니라면, 확률적으로 대화에 자연스럽게 끼어들어 반응한다(타이머로만 말하는 티 방지).
        const reactive = !mentioned && shouldTriggerReactiveReply(this.room, message, now);
        if (mentioned || reactive) {
          ai.lastReactiveReplyAt = now;
          const delay = mentioned ? 2000 + Math.random() * 3000 : 3000 + Math.random() * 4000;
          await this.enqueueEvent({ id: crypto.randomUUID(), type: 'AI_REACTIVE_REPLY', dueAt: now + delay });
        }
      }
    }
  }

  private async handleVoteCast(ws: WebSocket, player: Player, targetId: string) {
    if (!this.room) return;
    if (this.room.phase !== 'VOTING') return this.sendError(ws, '투표 시간이 아닙니다.');
    if (!player.isAlive) return this.sendError(ws, '투표할 수 없는 상태입니다.');
    const target = this.room.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return this.sendError(ws, '유효하지 않은 대상입니다.');
    if (player.id === targetId) return this.sendError(ws, '자기 자신에게는 투표할 수 없습니다.');

    this.room.votes[player.id] = targetId;
    await this.persist();
    const total = this.aliveVoters().length;
    this.broadcast({ type: 'vote:progress', payload: { voted: Object.keys(this.room.votes).length, total } });

    if (Object.keys(this.room.votes).length >= total) {
      this.cancelEventsByType('VOTING_END');
      await this.tallyVotes();
    }
  }

  private async handleGameStart(ws: WebSocket, player: Player) {
    if (!this.room) return;
    if (this.room.phase !== 'LOBBY') return this.sendError(ws, '이미 시작된 게임입니다.');
    if (this.room.hostId !== player.id) return this.sendError(ws, '방장만 게임을 시작할 수 있습니다.');
    const humanCount = this.room.players.filter((p) => !p.isAI).length;
    if (humanCount < MIN_PLAYERS_TO_START) {
      return this.sendError(ws, `최소 ${MIN_PLAYERS_TO_START}명이 모여야 시작할 수 있습니다.`);
    }
    const hostId = this.room.hostId;
    const notReady = this.room.players.filter((p) => !p.isAI && p.id !== hostId && !p.isReady);
    if (notReady.length > 0) {
      return this.sendError(ws, '모든 참가자가 준비 완료해야 시작할 수 있습니다.');
    }

    const aiPlayer: Player = {
      id: crypto.randomUUID(),
      nickname: '', // 아래에서 전원과 함께 다시 배정됨
      lobbyNickname: '',
      isAI: true,
      isAlive: true,
      connected: true,
      disconnectedAt: null,
      lastSeenAt: null,
      lastReactiveReplyAt: null,
      isReady: true,
    };
    this.room.players.push(aiPlayer);

    // 대기실 닉네임(계정 고정 닉네임)과 완전히 별개로, 이번 게임 한정으로 "1번/2번/3번..." 같은
    // 번호를 사람+AI 전원에게 동시에 배정한다. 단어 닉네임 대신 번호를 쓰면 대기실 닉네임과
    // 겹칠 걱정 자체가 없다. 배열 순서(AI는 항상 맨 뒤에 push됨)를 그대로 쓰면 "마지막 번호 =
    // AI"가 매 게임 반복되어 유추 가능해지므로, 번호를 매기기 전에 전체 순서를 섞는다.
    for (let i = this.room.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.room.players[i], this.room.players[j]] = [this.room.players[j], this.room.players[i]];
    }
    this.room.players.forEach((p, idx) => {
      p.nickname = `${idx + 1}번`;
    });

    this.room.topic = pickRandomTopic();
    this.room.aiPersona = pickAiPersona();
    this.room.round = 1;
    // 대기실 잡담과 게임 중 대화는 구분돼야 하므로, 시작하는 순간 채팅 로그를 비운다.
    this.room.chatLog = [];
    await this.startDiscussionPhase();
    await this.syncLobby();
  }

  private async handlePlayerReady(player: Player, ready: boolean) {
    if (!this.room) return;
    if (this.room.phase !== 'LOBBY') return;
    if (player.id === this.room.hostId) return; // 방장은 준비 상태 없이 바로 시작 버튼으로 제어
    player.isReady = Boolean(ready);
    await this.persist();
    this.broadcastState();
  }

  private async handlePlayerKick(ws: WebSocket, player: Player, targetId: string) {
    if (!this.room) return;
    if (this.room.phase !== 'LOBBY') return this.sendError(ws, '게임 중에는 강퇴할 수 없습니다.');
    if (player.id !== this.room.hostId) return this.sendError(ws, '방장만 강퇴할 수 있습니다.');
    if (targetId === player.id) return this.sendError(ws, '자기 자신은 강퇴할 수 없습니다.');
    const target = this.room.players.find((p) => p.id === targetId);
    if (!target) return this.sendError(ws, '대상을 찾을 수 없습니다.');

    await this.kickPlayer(targetId, '방장에 의해 강퇴되었습니다.');
  }

  // 방장 강퇴, 비속어 3회 누적 등 "즉시 강제 퇴장"이 필요한 모든 경로가 공유하는 헬퍼.
  // 대상의 소켓에 사유를 담아 kicked를 보내고 닫은 뒤, 방에서 제거한다.
  private async kickPlayer(targetId: string, reason: string) {
    if (this.room) {
      const target = this.room.players.find((p) => p.id === targetId);
      if (target?.appwriteUserId && !this.room.kickedUserIds.includes(target.appwriteUserId)) {
        this.room.kickedUserIds.push(target.appwriteUserId);
      }
    }
    for (const sock of this.ctx.getWebSockets()) {
      const attachment = sock.deserializeAttachment() as { playerId?: string } | null;
      if (attachment?.playerId !== targetId) continue;
      try {
        sock.send(JSON.stringify({ type: 'kicked', payload: { reason } } satisfies ServerMessage));
        sock.close(1000, 'kicked');
      } catch {
        // 이미 끊긴 소켓은 무시
      }
    }
    await this.removePlayer(targetId);
  }

  // ---------------- 게임 상태머신 ----------------

  private async startDiscussionPhase() {
    if (!this.room) return;
    this.room.phase = 'DISCUSSION';
    this.room.phaseEndsAt = Date.now() + this.discussionMs;
    this.room.votes = {};
    await this.persist();
    this.broadcastState();

    for (const offset of randomMessageOffsets(this.discussionMs)) {
      await this.enqueueEvent({ id: crypto.randomUUID(), type: 'AI_MESSAGE', dueAt: Date.now() + offset });
    }
    await this.enqueueEvent({ id: crypto.randomUUID(), type: 'DISCUSSION_END', dueAt: this.room.phaseEndsAt });
  }

  private async startVotingPhase() {
    if (!this.room) return;
    this.room.phase = 'VOTING';
    this.room.phaseEndsAt = Date.now() + this.votingMs;
    this.room.votes = {};
    await this.persist();
    this.broadcastState();
    await this.enqueueEvent({ id: crypto.randomUUID(), type: 'VOTING_END', dueAt: this.room.phaseEndsAt });
  }

  private async tallyVotes() {
    if (!this.room || this.room.phase !== 'VOTING') return;

    const counts = new Map<string, number>();
    for (const targetId of Object.values(this.room.votes)) {
      counts.set(targetId, (counts.get(targetId) || 0) + 1);
    }

    let eliminatedId: string | null = null;
    let tie = false;
    if (counts.size > 0) {
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const top = sorted[0][1];
      const topEntries = sorted.filter(([, c]) => c === top);
      if (topEntries.length === 1) eliminatedId = topEntries[0][0];
      else tie = true;
    }

    let eliminatedPlayer: Player | null = null;
    if (eliminatedId) {
      eliminatedPlayer = this.room.players.find((p) => p.id === eliminatedId) ?? null;
      if (eliminatedPlayer) {
        eliminatedPlayer.isAlive = false;
        if (!this.room.revealed.includes(eliminatedId)) this.room.revealed.push(eliminatedId);
      }
    }

    this.room.phase = 'ROUND_RESULT';
    // null로 두면 이 phase에서 자가치유(checkOverdueTransitions)가 다음 단계로 못 넘어가므로 실제 시각을 넣는다.
    this.room.phaseEndsAt = Date.now() + this.roundResultMs;
    await this.persist();

    this.broadcast({
      type: 'game:roundResult',
      payload: {
        round: this.room.round,
        tie,
        eliminatedId: eliminatedPlayer?.id ?? null,
        eliminatedNickname: eliminatedPlayer?.nickname ?? null,
        eliminatedIsAI: eliminatedPlayer?.isAI ?? null,
        voteCounts: Object.fromEntries(counts),
      },
    });
    this.broadcastState();

    await this.enqueueEvent({ id: crypto.randomUUID(), type: 'ROUND_ADVANCE', dueAt: Date.now() + this.roundResultMs });
  }

  private async checkWinCondition() {
    if (!this.room) return;
    const ai = findAiPlayer(this.room);
    const aliveHumans = this.room.players.filter((p) => !p.isAI && p.isAlive).length;

    if (!ai) {
      await this.endGame('HUMANS');
    } else if (aliveHumans <= 1) {
      await this.endGame('AI');
    } else if (this.room.round >= this.maxRounds) {
      await this.endGame('AI');
    } else {
      this.room.round += 1;
      await this.startDiscussionPhase();
    }
  }

  private async endGame(winner: 'HUMANS' | 'AI') {
    if (!this.room) return;
    // 알람과 자가치유 체크가 겹칠 때 endGame이 중복 호출되는 걸 막는 안전장치.
    if (this.room.phase === 'GAME_OVER') return;
    this.room.phase = 'GAME_OVER';
    this.room.phaseEndsAt = null;
    this.room.winner = winner;
    this.room.revealed = this.room.players.map((p) => p.id);
    this.events = [];
    await this.persist();

    this.broadcast({
      type: 'game:over',
      payload: {
        winner,
        players: this.room.players.map((p) => ({ id: p.id, nickname: p.nickname, isAI: p.isAI, isAlive: p.isAlive })),
      },
    });
    this.broadcastState();
    await this.syncLobby();
    await this.recordStats(winner);
  }

  // 로그인된 사람 플레이어만 전적을 남긴다 (AI는 계정이 없고, 게스트는 jwt가 없어서 자동으로 제외됨).
  // 유저별로 순차 처리한다 (동시에 여러 명을 Promise.all로 쏘면 로컬 개발 환경에서 fetch 응답이 꼬이는 현상 확인됨).
  private async recordStats(winner: 'HUMANS' | 'AI') {
    if (!this.room) return;
    const loggedInPlayers = this.room.players.filter((p) => !p.isAI && p.appwriteUserId);
    for (const p of loggedInPlayers) {
      await recordGameResult(this.env, p.appwriteUserId!, p.lobbyNickname || p.appwriteDisplayName || p.nickname, winner === 'HUMANS');
    }
  }

  private async emitAiMessage(reactive: boolean) {
    if (!this.room) return;
    const ai = findAiPlayer(this.room);
    if (!ai) return;

    // 반응형 발화면, 예약 당시가 아니라 지금 시점 기준 가장 최근 사람 메시지에 반응하게 한다
    // (딜레이 몇 초 사이에 대화가 더 진행됐을 수 있으므로 최신 걸 기준으로 삼는다).
    let reactingTo: ReactingTo | undefined;
    if (reactive) {
      const lastHuman = [...this.room.chatLog].reverse().find((m) => m.playerId !== ai.id);
      if (lastHuman) reactingTo = { nickname: lastHuman.nickname, text: lastHuman.text };
    }

    const text = await generateAiMessage(this.room, this.env, reactingTo);
    if (!text || this.room.phase !== 'DISCUSSION') return;

    const message: ChatMessage = { id: crypto.randomUUID(), playerId: ai.id, nickname: ai.nickname, text, ts: Date.now() };
    this.room.chatLog.push(message);
    await this.persist();
    this.broadcast({ type: 'chat:new', payload: message });
  }

  private async removePlayer(playerId: string) {
    if (!this.room) return;
    this.room.players = this.room.players.filter((p) => p.id !== playerId);
    if (this.room.hostId === playerId) {
      const nextHost = this.room.players.find((p) => !p.isAI);
      this.room.hostId = nextHost ? nextHost.id : null;
    }

    const remainingHumans = this.room.players.filter((p) => !p.isAI).length;
    if (this.room.players.length === 0 || remainingHumans === 0) {
      await this.removeFromLobby();
      this.room = null;
      this.events = [];
      await this.ctx.storage.deleteAll();
      return;
    }

    await this.persist();
    await this.syncLobby();
    this.broadcastState();
  }

  // ---------------- 알람(스케줄러) ----------------

  async alarm() {
    await this.loaded;
    if (!this.room) return;
    await this.checkStaleConnections();
    if (!this.room) return;

    const now = Date.now();
    const due = this.events.filter((e) => e.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
    this.events = this.events.filter((e) => e.dueAt > now);

    for (const event of due) {
      if (!this.room) break;
      switch (event.type) {
        case 'DISCUSSION_END':
          if (this.room.phase === 'DISCUSSION') await this.startVotingPhase();
          break;
        case 'VOTING_END':
          if (this.room.phase === 'VOTING') await this.tallyVotes();
          break;
        case 'ROUND_ADVANCE':
          if (this.room.phase === 'ROUND_RESULT') await this.checkWinCondition();
          break;
        case 'AI_MESSAGE':
          if (this.room.phase === 'DISCUSSION') await this.emitAiMessage(false);
          break;
        case 'AI_REACTIVE_REPLY':
          if (this.room.phase === 'DISCUSSION') await this.emitAiMessage(true);
          break;
        case 'DISCONNECT_GRACE': {
          const targetId = event.payload?.playerId as string | undefined;
          if (targetId) {
            const p = this.room.players.find((pl) => pl.id === targetId);
            if (p && !p.connected) await this.removePlayer(targetId);
          }
          break;
        }
      }
    }

    await this.persist();
    await this.rescheduleAlarm();
  }

  // ---------------- 유틸 ----------------

  private async enqueueEvent(event: ScheduledEvent) {
    this.events.push(event);
    await this.persist();
    await this.rescheduleAlarm();
  }

  private cancelEventsFor(type: ScheduledEvent['type'], playerId: string) {
    this.events = this.events.filter((e) => !(e.type === type && e.payload?.playerId === playerId));
  }

  private cancelEventsByType(type: ScheduledEvent['type']) {
    this.events = this.events.filter((e) => e.type !== type);
  }

  private async rescheduleAlarm() {
    if (this.events.length === 0) return;
    const next = Math.min(...this.events.map((e) => e.dueAt));
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next) {
      await this.ctx.storage.setAlarm(next);
    }
  }

  // 로컬 wrangler dev(Miniflare)의 알람 에뮬레이션이 드물게 재예약을 놓치는 경우에 대비한 안전망.
  // 실제 배포 환경의 Durable Object 알람은 신뢰성이 보장되지만, 혹시 모를 지연에도
  // 방으로 들어오는 다음 메시지가 있을 때 마감 시간이 지난 phase를 즉시 앞으로 진행시킨다.
  private async checkOverdueTransitions() {
    if (!this.room || !this.room.phaseEndsAt) return;
    if (this.room.phaseEndsAt > Date.now()) return;
    if (this.room.phase === 'DISCUSSION') await this.startVotingPhase();
    else if (this.room.phase === 'VOTING') await this.tallyVotes();
    else if (this.room.phase === 'ROUND_RESULT') await this.checkWinCondition();
  }

  private alivePlayers(): Player[] {
    return this.room ? this.room.players.filter((p) => p.isAlive) : [];
  }

  private aliveVoters(): Player[] {
    return this.alivePlayers().filter((p) => !p.isAI);
  }

  private async persist() {
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.put('events', this.events);
  }

  private lobbyStub() {
    const id = this.env.LOBBY.idFromName('global-lobby');
    return this.env.LOBBY.get(id);
  }

  private async syncLobby() {
    if (!this.room || !this.room.isPublic) return;
    const humanCount = this.room.players.filter((p) => !p.isAI).length;
    await this.lobbyStub().upsertRoom({
      id: this.room.id,
      name: this.room.name,
      playerCount: humanCount,
      maxPlayers: this.room.maxPlayers,
      phase: this.room.phase,
    });
  }

  private async removeFromLobby() {
    if (!this.room) return;
    await this.lobbyStub().removeRoom(this.room.id);
  }

  private broadcast(message: ServerMessage) {
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // 죽은 소켓은 무시
      }
    }
  }

  private broadcastState() {
    this.broadcast({ type: 'room:state', payload: this.serializeRoom() });
  }

  private sendError(ws: WebSocket, message: string) {
    try {
      ws.send(JSON.stringify({ type: 'error', payload: { message } } satisfies ServerMessage));
    } catch {
      // 죽은 소켓은 무시
    }
  }

  private sendChatMuted(ws: WebSocket, mutedUntil: number) {
    try {
      ws.send(JSON.stringify({ type: 'chat:muted', payload: { mutedUntil } } satisfies ServerMessage));
    } catch {
      // 죽은 소켓은 무시
    }
  }

  private serializeRoom(): RoomStateView {
    if (!this.room) throw new Error('room not initialized');
    const room = this.room;
    const gameOver = room.phase === 'GAME_OVER';
    return {
      id: room.id,
      name: room.name,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      phase: room.phase,
      round: room.round,
      phaseEndsAt: room.phaseEndsAt,
      winner: room.winner,
      topic: room.topic,
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isAlive: p.isAlive,
        connected: p.connected,
        isHost: p.id === room.hostId,
        isReady: p.isReady,
        isAI: gameOver || room.revealed.includes(p.id) ? p.isAI : undefined,
      })),
      chatLog: room.chatLog.slice(-200),
    };
  }
}
