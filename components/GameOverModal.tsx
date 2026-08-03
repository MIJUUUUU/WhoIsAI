'use client';

import type { GameOverPayload } from '@/types/game';
import Modal from './Modal';

export default function GameOverModal({
  payload,
  onLeave,
  onReturnToLobby,
  isHost,
}: {
  payload: GameOverPayload;
  onLeave: () => void;
  onReturnToLobby: () => void;
  isHost: boolean;
}) {
  return (
    <Modal>
      <div className="text-center">
        <h2 className="text-xl font-bold">
          {payload.winner === 'HUMANS' ? '🎉 인간 승리!' : '🤖 AI 승리...'}
        </h2>
        <ul className="mt-4 space-y-1 text-left">
          {payload.players.map((p) => (
            <li
              key={p.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                p.isAI ? 'bg-red-950 text-red-300' : 'bg-neutral-800'
              }`}
            >
              {p.nickname} — {p.isAI ? 'AI' : '사람'} {!p.isAlive && '(탈락)'}
            </li>
          ))}
        </ul>
        {isHost && (
          <button
            onClick={onReturnToLobby}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500"
          >
            대기실로 돌아가기
          </button>
        )}
        <button
          onClick={onLeave}
          className={`w-full rounded-xl py-3 font-semibold ${
            isHost
              ? 'mt-2 bg-neutral-800 hover:bg-neutral-700'
              : 'mt-4 bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          로비로 나가기
        </button>
      </div>
    </Modal>
  );
}
