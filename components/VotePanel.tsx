'use client';

import type { PlayerView, VoteProgressPayload } from '@/types/game';

export default function VotePanel({
  candidates,
  viewerId,
  onVote,
  hasVoted,
  progress,
}: {
  candidates: PlayerView[];
  viewerId: string;
  onVote: (targetId: string) => void;
  hasVoted: boolean;
  progress: VoteProgressPayload | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-center text-sm text-neutral-400">
        누가 AI라고 생각하나요?
        {progress && ` (${progress.voted}/${progress.total} 투표완료)`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {candidates
          .filter((p) => p.id !== viewerId)
          .map((p) => (
            <button
              key={p.id}
              disabled={hasVoted}
              onClick={() => onVote(p.id)}
              className="rounded-lg bg-neutral-800 py-3 font-medium hover:bg-red-700 disabled:opacity-40"
            >
              {p.nickname}
            </button>
          ))}
      </div>
      {hasVoted && (
        <p className="text-center text-xs text-neutral-500">
          투표 완료. 다른 사람들을 기다리는 중...
        </p>
      )}
    </div>
  );
}
