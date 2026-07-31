'use client';

import type { RoundResultPayload } from '@/types/game';
import Modal from './Modal';

export default function RoundResultModal({ result }: { result: RoundResultPayload }) {
  return (
    <Modal>
      <div className="text-center">
        <p className="text-sm text-neutral-400">{result.round}라운드 결과</p>
        {result.tie ? (
          <p className="mt-2 text-lg font-semibold">동률로 아무도 탈락하지 않았습니다.</p>
        ) : (
          <>
            <p className="mt-2 text-lg font-semibold">
              <span className="text-red-400">{result.eliminatedNickname}</span>님이 탈락했습니다
            </p>
            <p
              className={`mt-1 text-sm ${
                result.eliminatedIsAI ? 'text-emerald-400' : 'text-neutral-400'
              }`}
            >
              {result.eliminatedIsAI ? '정체는 AI였습니다!' : '정체는 사람이었습니다...'}
            </p>
          </>
        )}
        <p className="mt-4 text-xs text-neutral-500">잠시 후 계속됩니다...</p>
      </div>
    </Modal>
  );
}
