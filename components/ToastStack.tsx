'use client';

export interface ToastItem {
  id: string;
  message: string;
}

export default function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border border-neutral-700 bg-neutral-800/95 px-4 py-2 text-sm shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
