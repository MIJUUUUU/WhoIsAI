'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';

export default function ChatMuteModal({
  mutedUntil,
  onClose,
}: {
  mutedUntil: number;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingSec = Math.max(0, Math.ceil((mutedUntil - now) / 1000));

  useEffect(() => {
    if (remainingSec === 0) onClose();
  }, [remainingSec, onClose]);

  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">채팅이 잠겼어요</h2>
        <p className="mt-3 text-sm text-neutral-400">
          너무 빠르게 채팅을 보내서 잠시 채팅이 제한됐어요.
        </p>
        <p className="mt-4 font-mono text-3xl font-bold tabular-nums text-emerald-400">
          {remainingSec}초
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-neutral-800 py-2.5 font-semibold hover:bg-neutral-700"
        >
          닫기
        </button>
      </div>
    </Modal>
  );
}
