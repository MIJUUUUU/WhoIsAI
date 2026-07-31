'use client';

import type { LobbyRoomSummary } from '@/types/game';

const PHASE_LABEL: Record<string, string> = {
  LOBBY: '대기중',
  DISCUSSION: '토론중',
  VOTING: '투표중',
  ROUND_RESULT: '결과발표',
  GAME_OVER: '종료',
};

export default function RoomList({
  rooms,
  onJoin,
}: {
  rooms: LobbyRoomSummary[];
  onJoin: (roomId: string) => void;
}) {
  if (rooms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        아직 열려있는 공개방이 없어요. 첫 방을 만들어보세요!
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rooms.map((r) => {
        const joinable = r.phase === 'LOBBY' && r.playerCount < r.maxPlayers;
        return (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
          >
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-neutral-500">
                {r.playerCount}/{r.maxPlayers}명 · {PHASE_LABEL[r.phase]}
              </p>
            </div>
            <button
              disabled={!joinable}
              onClick={() => onJoin(r.id)}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600"
            >
              입장
            </button>
          </li>
        );
      })}
    </ul>
  );
}
