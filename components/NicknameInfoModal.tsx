'use client';

import Modal from './Modal';

export default function NicknameInfoModal({
  realName,
  nickname,
  onClose,
}: {
  realName?: string;
  nickname: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">닉네임이 사라졌어요!</h2>
        <p className="mt-3 text-sm text-neutral-400">
          {realName ? `${realName}님은 ` : '당신은 '}지금부터{' '}
          <span className="font-semibold text-emerald-400">{nickname}</span>(으)로 보여요.
        </p>
        <p className="mt-2 text-xs text-neutral-500">참가자 전원이 번호로 뒤섞였어요. AI를 찾아보세요!</p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-semibold hover:bg-emerald-500"
        >
          확인
        </button>
      </div>
    </Modal>
  );
}
