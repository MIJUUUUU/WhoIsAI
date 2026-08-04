'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '@/types/game';

function formatTime(ts: number) {
  const d = new Date(ts);
  const hours = d.getHours();
  const period = hours < 12 ? '오전' : '오후';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${period} ${displayHour}:${minutes}`;
}

export default function ChatBox({
  messages,
  viewerId,
  disabled,
  onSend,
}: {
  messages: ChatMessage[];
  viewerId: string;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || disabled) return;
    onSend(clean);
    setText('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="thin-scrollbar min-h-[180px] flex-1 space-y-2 overflow-y-auto p-3 sm:min-h-[220px]" style={{ maxHeight: 360 }}>
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-600">아직 대화가 없어요. 먼저 말을 걸어보세요.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.playerId === viewerId ? 'text-right' : ''}>
            <span className="block text-xs text-neutral-500">{m.nickname}</span>
            <div
              className={`flex items-end gap-1 ${
                m.playerId === viewerId ? 'flex-row-reverse' : ''
              }`}
            >
              <p
                className={`inline-block max-w-[80%] break-words rounded-lg px-3 py-1.5 text-sm ${
                  m.playerId === viewerId ? 'bg-emerald-700' : 'bg-neutral-800'
                }`}
              >
                {m.text}
              </p>
              <span className="mb-0.5 shrink-0 text-[10px] text-neutral-600">
                {formatTime(m.ts)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-neutral-800 p-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={300}
          placeholder={disabled ? '지금은 채팅할 수 없습니다' : '메시지 입력...'}
          enterKeyHint="send"
          className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          className="rounded-lg bg-emerald-600 px-4 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </div>
  );
}
