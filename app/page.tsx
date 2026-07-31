'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchLobby, joinRoom } from '@/lib/api';
import { saveSession } from '@/lib/clientSession';
import { useAuth } from '@/hooks/useAuth';
import { useNicknameSetup } from '@/hooks/useNicknameSetup';
import type { LobbyRoomSummary } from '@/types/game';
import RoomList from '@/components/RoomList';
import CreateRoomModal from '@/components/CreateRoomModal';
import AuthStatus from '@/components/AuthStatus';
import SetNicknameModal from '@/components/SetNicknameModal';
import AlertModal from '@/components/AlertModal';

const LOBBY_POLL_MS = 4000;

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, refresh } = useAuth();
  const { needsNickname, nicknameSuggestion, handleSetNickname } = useNicknameSetup(user, authLoading, refresh);
  const [rooms, setRooms] = useState<LobbyRoomSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const list = await fetchLobby();
      if (!cancelled) setRooms(list);
    }
    poll();
    const id = setInterval(poll, LOBBY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleJoin(roomId: string) {
    if (!user) {
      login(`/room/${roomId}`);
      return;
    }
    setJoining(true);
    setJoinError(null);
    const res = await joinRoom(roomId);
    setJoining(false);
    if (!res.ok || !res.playerId || !res.nickname) {
      setJoinError(res.error || '입장에 실패했습니다.');
      return;
    }
    saveSession({ roomId, playerId: res.playerId, nickname: res.nickname });
    router.push(`/room/${roomId}`);
  }

  function handleJoinByCode(e: FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length >= 4) handleJoin(code);
  }

  function handleCreateClick() {
    if (!user) {
      login();
      return;
    }
    setShowCreate(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/leaderboard" className="text-sm text-neutral-400 hover:underline">
          리더보드
        </Link>
        <AuthStatus />
      </div>

      <header className="text-center">
        <h1 className="text-2xl font-bold">누가 AI일까?</h1>
        <p className="mt-1 text-sm text-neutral-400">
          채팅방에 숨어든 AI를 3분 안에 찾아내세요
        </p>
      </header>

      {!authLoading && !user && (
        <p className="text-center text-xs text-neutral-500">
          방을 만들거나 입장하려면 로그인이 필요해요.
        </p>
      )}

      <button
        onClick={handleCreateClick}
        className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500"
      >
        + 새 방 만들기
      </button>

      <form onSubmit={handleJoinByCode} className="flex gap-2">
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="초대 코드로 입장"
          maxLength={6}
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={joining}
          className="rounded-lg bg-neutral-800 px-4 hover:bg-neutral-700 disabled:opacity-50"
        >
          입장
        </button>
      </form>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">공개방 목록</h2>
        <RoomList rooms={rooms} onJoin={handleJoin} />
      </section>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} />}
      {needsNickname && (
        <SetNicknameModal suggested={nicknameSuggestion} onSubmit={handleSetNickname} />
      )}
      {joinError && <AlertModal title={joinError} onClose={() => setJoinError(null)} />}
    </main>
  );
}
