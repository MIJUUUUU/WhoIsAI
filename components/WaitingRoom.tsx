'use client';

import { MIN_PLAYERS_TO_START, type RoomState } from '@/types/game';

export default function WaitingRoom({
  room,
  viewerId,
  onStart,
  startError,
}: {
  room: RoomState;
  viewerId: string;
  onStart: () => void;
  startError: string | null;
}) {
  const isHost = room.hostId === viewerId;
  const humanCount = room.players.length;
  const canStart = humanCount >= MIN_PLAYERS_TO_START;

  function copyInvite() {
    const url = `${window.location.origin}/room/${room.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-sm text-neutral-400">초대 코드 (링크로 공유하세요)</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-bold tracking-widest">{room.id}</span>
          <button
            onClick={copyInvite}
            className="rounded-lg bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
          >
            링크 복사
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-400">
          참가자 ({humanCount}/{room.maxPlayers})
        </p>
        <ul className="space-y-1">
          {room.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
            >
              <span>
                {p.nickname}
                {p.id === viewerId && <span className="ml-1 text-xs text-emerald-400">(나)</span>}
                {!p.connected && <span className="ml-1 text-xs text-neutral-600">(연결끊김)</span>}
              </span>
              {p.isHost && <span className="text-xs text-amber-400">방장</span>}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-40"
        >
          {canStart ? '게임 시작' : `최소 ${MIN_PLAYERS_TO_START}명 필요 (${humanCount}/${MIN_PLAYERS_TO_START})`}
        </button>
      ) : (
        <p className="text-center text-sm text-neutral-500">
          방장이 게임을 시작하길 기다리는 중...
        </p>
      )}
      {startError && <p className="text-center text-sm text-red-400">{startError}</p>}
    </div>
  );
}
