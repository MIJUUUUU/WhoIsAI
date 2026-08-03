import type { RoomState } from '@/types/game';

export default function TopicBanner({ topic }: { topic: RoomState['topic'] }) {
  if (!topic) return null;
  return (
    <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3">
      <p className="text-xs font-semibold text-emerald-400">오늘의 주제 · {topic.title}</p>
      <p className="mt-1 text-sm text-neutral-300">{topic.question}</p>
    </div>
  );
}
