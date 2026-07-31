'use client';

import Modal from './Modal';

export default function AlertModal({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <p className="text-center text-sm text-neutral-200">{title}</p>
      <button
        onClick={onClose}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-semibold hover:bg-emerald-500"
      >
        확인
      </button>
    </Modal>
  );
}
