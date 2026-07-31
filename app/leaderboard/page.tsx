'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LeaderboardEntry {
  displayName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">리더보드</h1>
        <Link href="/" className="text-sm text-emerald-400 hover:underline">
          로비로
        </Link>
      </header>

      {entries === null && <p className="text-sm text-neutral-500">불러오는 중...</p>}
      {entries?.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500">
          아직 기록된 전적이 없어요. 로그인하고 게임을 플레이해보세요!
        </p>
      )}

      {entries && entries.length > 0 && (
        <ol className="space-y-2">
          {entries.map((entry, i) => (
            <li
              key={entry.displayName + i}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm text-neutral-500">{i + 1}</span>
                <span className="font-medium">{entry.displayName}</span>
              </div>
              <span className="text-sm text-neutral-400">
                {entry.wins}승 {entry.losses}패 ({entry.gamesPlayed}판)
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
