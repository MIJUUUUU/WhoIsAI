'use client';

import { useEffect, useState } from 'react';

export default function RoundTimer({ endsAt }: { endsAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;

  const remainingMs = Math.max(0, endsAt - now);
  const totalSec = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 font-mono text-sm tabular-nums">
      ⏱ {m}:{s.toString().padStart(2, '0')}
    </div>
  );
}
