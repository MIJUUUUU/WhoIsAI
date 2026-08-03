'use client';

import { useState } from 'react';
import { MIN_PLAYERS_TO_START, type RoomState } from '@/types/game';
import ConfirmModal from './ConfirmModal';
import ChatBox from './ChatBox';

export default function WaitingRoom({
  room,
  viewerId,
  onStart,
  startError,
  onToggleReady,
  onKick,
  onSend,
  onCopyInvite,
  chatMutedUntil,
}: {
  room: RoomState;
  viewerId: string;
  onStart: () => void;
  startError: string | null;
  onToggleReady: (ready: boolean) => void;
  onKick: (targetId: string) => void;
  onSend: (text: string) => void;
  onCopyInvite: () => void;
  chatMutedUntil: number | null;
}) {
  const [kickTarget, setKickTarget] = useState<{ id: string; nickname: string } | null>(null);

  const isHost = room.hostId === viewerId;
  const humanCount = room.players.length;
  const hasEnoughPlayers = humanCount >= MIN_PLAYERS_TO_START;
  const nonHostPlayers = room.players.filter((p) => !p.isHost);
  const allReady = nonHostPlayers.every((p) => p.isReady);
  const canStart = hasEnoughPlayers && allReady;
  const self = room.players.find((p) => p.id === viewerId);

  function copyInvite() {
    navigator.clipboard?.writeText(room.id).then(onCopyInvite).catch(() => {});
  }


  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-sm text-neutral-400">초대 코드</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-bold tracking-widest">{room.id}</span>
          <button
            onClick={copyInvite}
            className="rounded-lg bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
          >
            코드 복사
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
              <div className="flex items-center gap-2">
                {p.isHost ? (
                  <span className="text-xs text-amber-400">방장</span>
                ) : (
                  <span className={`text-xs ${p.isReady ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {p.isReady ? '준비완료' : '대기 중'}
                  </span>
                )}
                {isHost && !p.isHost && (
                  <button
                    onClick={() => setKickTarget({ id: p.id, nickname: p.nickname })}
                    className="rounded-lg bg-neutral-800 px-2 py-1 text-xs text-red-400 hover:bg-neutral-700"
                  >
                    강퇴
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ChatBox
        messages={room.chatLog}
        viewerId={viewerId}
        disabled={chatMutedUntil !== null}
        onSend={onSend}
      />

      {!isHost && self && (
        <button
          onClick={() => onToggleReady(!self.isReady)}
          className={`w-full rounded-xl py-3 font-semibold ${
            self.isReady
              ? 'bg-neutral-800 hover:bg-neutral-700'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {self.isReady ? '준비 취소' : '준비 완료'}
        </button>
      )}

      {isHost ? (
        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-40"
        >
          시작하기
        </button>
      ) : (
        <p className="text-center text-sm text-neutral-500">
          방장이 게임을 시작하길 기다리는 중...
        </p>
      )}
      {startError && <p className="text-center text-sm text-red-400">{startError}</p>}

      {kickTarget && (
        <ConfirmModal
          title={`${kickTarget.nickname}님을 강퇴하시겠어요?`}
          confirmLabel="강퇴"
          onConfirm={() => {
            onKick(kickTarget.id);
            setKickTarget(null);
          }}
          onCancel={() => setKickTarget(null)}
        />
      )}
    </div>
  );
}
