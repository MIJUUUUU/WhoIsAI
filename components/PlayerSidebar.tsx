'use client';

import type { RoomState } from '@/types/game';

export default function PlayerSidebar({ room, viewerId }: { room: RoomState; viewerId: string }) {
  return (
    <ul className="flex flex-row gap-1.5 overflow-x-auto sm:flex-col sm:overflow-visible">
      {room.players.map((p) => (
        <li
          key={p.id}
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
            p.isAlive
              ? 'border-neutral-800 bg-neutral-900'
              : 'border-neutral-900 bg-neutral-950 text-neutral-600 line-through'
          }`}
        >
          <div className="flex items-center justify-between gap-2 whitespace-nowrap">
            <span>
              {p.nickname}
              {p.id === viewerId && <span className="ml-1 text-emerald-400">(나)</span>}
            </span>
            {!p.connected && <span className="text-xs text-neutral-600">(끊김)</span>}
          </div>
          {p.isAI !== undefined && (
            <span className={`text-xs no-underline ${p.isAI ? 'text-red-400' : 'text-neutral-500'}`}>
              {p.isAI ? 'AI였음' : '사람'}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
