'use client';

import { useState, type FormEvent } from 'react';
import Modal from './Modal';

export default function SetNicknameModal({
  suggested,
  onSubmit,
}: {
  suggested: string;
  onSubmit: (nickname: string) => Promise<void>;
}) {
  const [value, setValue] = useState(suggested);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = value.trim().slice(0, 12);
    if (!clean) return;
    setSubmitting(true);
    setError(null);
    void onSubmit(clean)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  }

  return (
    <Modal>
      <h2 className="text-center text-lg font-semibold">닉네임을 정해주세요</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={12}
          autoFocus
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-center text-base outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '이 닉네임으로 할게요'}
        </button>
      </form>
    </Modal>
  );
}
