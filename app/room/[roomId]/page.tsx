'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useAuth } from '@/hooks/useAuth';
import { useNicknameSetup } from '@/hooks/useNicknameSetup';
import { joinRoom } from '@/lib/api';
import { loadSession, saveSession, clearSession } from '@/lib/clientSession';
import type { GameOverPayload, RoomState, RoundResultPayload, VoteProgressPayload } from '@/types/game';
import WaitingRoom from '@/components/WaitingRoom';
import PlayerSidebar from '@/components/PlayerSidebar';
import ChatBox from '@/components/ChatBox';
import VotePanel from '@/components/VotePanel';
import RoundTimer from '@/components/RoundTimer';
import RoundResultModal from '@/components/RoundResultModal';
import GameOverModal from '@/components/GameOverModal';
import NicknameInfoModal from '@/components/NicknameInfoModal';
import ConfirmModal from '@/components/ConfirmModal';
import SetNicknameModal from '@/components/SetNicknameModal';
import ToastStack, { type ToastItem } from '@/components/ToastStack';

type JoinPhase = 'checking' | 'notJoined' | 'joined';
const TOAST_DURATION_MS = 4000;

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = String(params.roomId).toUpperCase();
  const router = useRouter();
  const { user, loading: authLoading, login, refresh } = useAuth();
  const { needsNickname, nicknameSuggestion, handleSetNickname } = useNicknameSetup(user, authLoading, refresh);

  const [joinPhase, setJoinPhase] = useState<JoinPhase>('checking');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const [room, setRoom] = useState<RoomState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [voteProgress, setVoteProgress] = useState<VoteProgressPayload | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [showNicknameInfo, setShowNicknameInfo] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const receivedStateRef = useRef(false);
  const roomRef = useRef<RoomState | null>(null);

  function pushToast(message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }

  useEffect(() => {
    // localStorage(외부 시스템) 조회 결과를 반영하는 것이므로 effect 내 setState가 맞다.
    const session = loadSession(roomId);
    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlayerId(session.playerId);
      setJoinPhase('joined');
    } else {
      setJoinPhase('notJoined');
    }
  }, [roomId]);

  const { sendMessage } = useGameSocket(joinPhase === 'joined' ? roomId : null, playerId, {
    'room:state': (payload) => {
      receivedStateRef.current = true;
      const prev = roomRef.current;
      if (prev) {
        // 대기실 단계에서만 알림(게임 시작 시 AI가 조용히 추가되는 걸 "입장"으로 오해하지 않도록).
        if (payload.phase === 'LOBBY') {
          const prevIds = new Set(prev.players.map((p) => p.id));
          payload.players
            .filter((p) => !prevIds.has(p.id))
            .forEach((p) => pushToast(`${p.nickname}님이 입장했어요`));
        }
        const nextIds = new Set(payload.players.map((p) => p.id));
        prev.players
          .filter((p) => !nextIds.has(p.id))
          .forEach((p) => pushToast(`${p.nickname}님이 나갔어요`));
        // 대기실 -> 토론으로 넘어가는 순간(=닉네임이 실제로 재배정되는 순간)에만 안내를 띄운다.
        if (prev.phase === 'LOBBY' && payload.phase !== 'LOBBY') {
          setShowNicknameInfo(true);
        }
      }
      roomRef.current = payload;
      setRoom(payload);
    },
    'chat:new': (payload) => {
      setRoom((prev) => (prev ? { ...prev, chatLog: [...prev.chatLog, payload] } : prev));
    },
    'vote:progress': (payload) => setVoteProgress(payload),
    'game:roundResult': (payload) => {
      setRoundResult(payload);
      setHasVoted(false);
      setVoteProgress(null);
    },
    'game:over': (payload) => setGameOver(payload),
    error: (payload) => {
      if (!receivedStateRef.current) {
        // 첫 room:state를 받기 전 에러 = 저장된 세션이 더 이상 유효하지 않음
        clearSession(roomId);
        setPlayerId(null);
        setJoinPhase('notJoined');
        return;
      }
      setActionError(payload.message);
      setHasVoted(false);
    },
  });

  async function handleJoin() {
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
    setPlayerId(res.playerId);
    setJoinPhase('joined');
  }

  function handleStart() {
    setActionError(null);
    sendMessage({ type: 'game:start' });
  }

  function handleSend(text: string) {
    sendMessage({ type: 'chat:send', text });
  }

  function handleVote(targetId: string) {
    setHasVoted(true);
    sendMessage({ type: 'vote:cast', targetId });
  }

  function handleLeave() {
    clearSession(roomId);
    router.push('/');
  }

  function requestLeave() {
    setShowLeaveConfirm(true);
  }

  if (joinPhase === 'checking') {
    return <CenteredMessage text="입장 확인 중..." />;
  }

  if (joinPhase === 'notJoined') {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
        <h1 className="text-center text-xl font-bold">방 입장</h1>
        <p className="text-center text-sm text-neutral-500">코드: {roomId}</p>
        <p className="text-center text-xs text-neutral-600">
          입장하면 닉네임이 자동으로 배정돼요.
        </p>
        {!authLoading && !user && (
          <p className="text-center text-xs text-neutral-500">입장하려면 로그인이 필요해요.</p>
        )}
        {joinError && <p className="text-center text-sm text-red-400">{joinError}</p>}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {joining ? '입장 중...' : '입장하기'}
        </button>
      </main>
    );
  }

  if (!room || !playerId) {
    return <CenteredMessage text="방 정보를 불러오는 중..." />;
  }

  const viewerId = playerId;
  const self = room.players.find((p) => p.id === viewerId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">{room.name}</h1>
          <p className="text-xs text-neutral-500">
            코드: {room.id}
            {room.round > 0 && ` · ${room.round}라운드`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER' && (
            <RoundTimer endsAt={room.phaseEndsAt} />
          )}
          <button
            onClick={requestLeave}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            나가기
          </button>
        </div>
      </header>

      {room.phase === 'LOBBY' ? (
        <WaitingRoom room={room} viewerId={viewerId} onStart={handleStart} startError={actionError} />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
          <PlayerSidebar room={room} viewerId={viewerId} />
          <div className="flex flex-col gap-4">
            {room.phase === 'VOTING' ? (
              <VotePanel
                candidates={room.players.filter((p) => p.isAlive)}
                viewerId={viewerId}
                onVote={handleVote}
                hasVoted={hasVoted}
                progress={voteProgress}
              />
            ) : (
              <ChatBox
                messages={room.chatLog}
                viewerId={viewerId}
                disabled={!self?.isAlive || room.phase !== 'DISCUSSION'}
                onSend={handleSend}
              />
            )}
          </div>
        </div>
      )}

      {room.phase === 'ROUND_RESULT' && roundResult && <RoundResultModal result={roundResult} />}
      {room.phase === 'GAME_OVER' && gameOver && (
        <GameOverModal payload={gameOver} onLeave={handleLeave} />
      )}
      {showNicknameInfo && self && (
        <NicknameInfoModal
          realName={user?.name}
          nickname={self.nickname}
          onClose={() => setShowNicknameInfo(false)}
        />
      )}
      {showLeaveConfirm && (
        <ConfirmModal
          title="정말 방을 나가시겠어요?"
          confirmLabel="나가기"
          onConfirm={handleLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
      {needsNickname && (
        <SetNicknameModal suggested={nicknameSuggestion} onSubmit={handleSetNickname} />
      )}
      <ToastStack toasts={toasts} />
    </main>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-neutral-500">{text}</p>
    </main>
  );
}
