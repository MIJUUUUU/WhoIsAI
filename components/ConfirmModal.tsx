'use client';

import Modal from './Modal';

export default function ConfirmModal({
  title,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel}>
      <p className="text-center text-sm text-neutral-200">{title}</p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg bg-neutral-800 py-2 hover:bg-neutral-700"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-red-700 py-2 font-medium hover:bg-red-600"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
