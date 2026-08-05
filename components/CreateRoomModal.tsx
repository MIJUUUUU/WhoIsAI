"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { saveSession } from "@/lib/clientSession";
import Modal from "./Modal";

export default function CreateRoomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  // 숫자(number) state로 직접 바인딩하면 지웠을 때 Number('')===0이 되어 "0"이 찍히고,
  // 그 뒤에 이어 입력하면 "04"처럼 앞에 0이 남는 문제가 있어서 문자열로 관리하고 제출 시에만 파싱한다.
  const [maxPlayersInput, setMaxPlayersInput] = useState("6");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("방 제목을 입력해주세요.");
      return;
    }
    setNameError(null);
    setLoading(true);
    setError(null);
    const maxPlayers = Math.min(6, Math.max(2, Number(maxPlayersInput) || 6));
    const res = await createRoom({ name, isPublic, maxPlayers });
    setLoading(false);
    if (!res.ok || !res.roomId || !res.playerId || !res.nickname) {
      setError(res.error || "방 생성에 실패했습니다.");
      return;
    }
    saveSession({
      roomId: res.roomId,
      playerId: res.playerId,
      nickname: res.nickname,
    });
    router.push(`/room/${res.roomId}`);
  }

  return (
    <Modal onClose={loading ? () => {} : onClose}>
      <h2 className="mb-4 text-lg font-semibold">방 만들기</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-400">방 이름</label>
            <input
              value={name}
              disabled={loading}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            maxLength={30}
            placeholder="예: 심심해서 만든 방"
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm text-neutral-400">최대 인원 (2~6)</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setMaxPlayersInput(String(Math.max(2, (Number(maxPlayersInput) || 2) - 1)))
              }
              className="h-9 w-9 rounded-lg bg-neutral-800 text-lg hover:bg-neutral-700"
            >
              −
            </button>
            <input
              type="text"
              disabled={loading}
              inputMode="numeric"
              pattern="[0-9]*"
              value={maxPlayersInput}
              onChange={(e) => setMaxPlayersInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 1))}
              onBlur={() => setMaxPlayersInput(String(Math.min(6, Math.max(2, Number(maxPlayersInput) || 6))))}
              className="w-12 rounded-lg bg-neutral-800 px-2 py-2 text-center text-base outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setMaxPlayersInput(String(Math.min(6, (Number(maxPlayersInput) || 6) + 1)))
              }
              className="h-9 w-9 rounded-lg bg-neutral-800 text-lg hover:bg-neutral-700"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="isPublic"
            type="checkbox"
            disabled={loading}
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <label htmlFor="isPublic" className="text-sm text-neutral-400">
            공개방으로 로비에 노출
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg bg-neutral-800 py-2 hover:bg-neutral-700"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="flex-1 rounded-lg bg-emerald-600 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "방 만드는 중..." : error ? "다시 시도" : "만들기"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
