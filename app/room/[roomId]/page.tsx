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
import TopicBanner from '@/components/TopicBanner';
import AlertModal from '@/components/AlertModal';
import ChatMuteModal from '@/components/ChatMuteModal';
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
  const [chatMutedUntil, setChatMutedUntil] = useState<number | null>(null);
  const [profanityWarning, setProfanityWarning] = useState<string | null>(null);
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
    'chat:muted': (payload) => setChatMutedUntil(payload.mutedUntil),
    'chat:warning': (payload) => {
      setProfanityWarning(
        `비속어 사용이 감지돼서 메시지가 가려졌어요. 경고 ${payload.count}/${payload.limit}회 — ${payload.limit}회 누적되면 강제 퇴장돼요.`
      );
    },
    kicked: (payload) => {
      // 강퇴/제재로 방에서 나가게 된 거라 이 방 링크에 남겨둘 이유가 없다 — 메인 로비로 보낸다.
      clearSession(roomId);
      router.push(`/?notice=${encodeURIComponent(payload.reason)}`);
    },
    'session:replaced': (payload) => {
      clearSession(roomId);
      router.push(`/?notice=${encodeURIComponent(payload.message)}`);
    },
    error: (payload) => {
      if (payload.message === '플레이어 정보를 찾을 수 없습니다.' && receivedStateRef.current) {
        // 이미 방에 있었는데 재접속 시 서버가 나를 제거한 상태(유예 만료, 연결 끊김 자동 감지 등)로
        // 확인됨 = 더 이상 이 방에 남아있을 이유가 없으니 메인 로비로 보낸다.
        clearSession(roomId);
        router.push(`/?notice=${encodeURIComponent('접속이 끊겨서 방에서 나가졌어요.')}`);
        return;
      }
      if (!receivedStateRef.current) {
        // 첫 room:state를 받기 전 에러 = 저장된 세션이 더 이상 유효하지 않음. 이 방 자체는
        // 여전히 유효할 수 있으니(잘못된 세션일 뿐) 같은 화면에서 "입장하기"로 다시 시도하게 한다.
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
      // autojoin 표시를 남겨서, 로그인 후 돌아왔을 때 또 "입장하기"를 누르게 하지 않고
      // 바로 입장 처리한다 (진짜 링크로 막 들어온 경우와 구분하기 위한 표시).
      login(`/room/${roomId}?autojoin=1`);
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

  useEffect(() => {
    // 로그인이 필요해서 로그인 페이지로 갔다가 돌아온 경우(autojoin 표시가 있음)엔
    // "입장하기"를 또 누르게 하지 않고 바로 입장시킨다. 진짜 링크로 막 들어온 경우엔
    // 이 표시가 없으니 그대로 확인 화면이 보인다.
    if (authLoading || !user || joinPhase !== 'notJoined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autojoin') !== '1') return;
    router.replace(`/room/${roomId}`);
    // URL의 autojoin 표시(외부 신호)를 반영해 자동 입장시키는 것이므로 effect 내 호출이 맞다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleJoin();
    // handleJoin은 매 렌더 새로 만들어지고, 이 effect는 autojoin 파라미터가 사라지면 스스로
    // 멈추므로 의존성에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, joinPhase, roomId, router]);

  function handleStart() {
    setActionError(null);
    sendMessage({ type: 'game:start' });
  }

  function handleToggleReady(ready: boolean) {
    sendMessage({ type: 'player:ready', ready });
  }

  function handleKick(targetId: string) {
    sendMessage({ type: 'player:kick', targetId });
  }

  function handleSend(text: string) {
    sendMessage({ type: 'chat:send', text });
  }

  function handleVote(targetId: string) {
    setHasVoted(true);
    sendMessage({ type: 'vote:cast', targetId });
  }

  function handleLeave() {
    sendMessage({ type: 'leave' });
    clearSession(roomId);
    router.push('/');
  }

  function requestLeave() {
    setShowLeaveConfirm(true);
  }

  function handleReturnToLobby() {
    sendMessage({ type: 'return_to_lobby' });
    setGameOver(null);
    setRoundResult(null);
    setVoteProgress(null);
    setHasVoted(false);
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
          이미 정해둔 닉네임이 있으면 그대로 쓰고, 처음이면 새로 정할 수 있어요.
        </p>
        {!authLoading && !user && (
          <p className="text-center text-xs text-neutral-500">입장하려면 로그인이 필요해요.</p>
        )}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {joining ? '입장 중...' : '입장하기'}
        </button>
        {joinError && <AlertModal title={joinError} onClose={() => router.push('/')} />}
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
          {room.phase !== 'LOBBY' && (
            <p className="text-xs text-neutral-500">
              코드: {room.id}
              {room.round > 0 && ` · ${room.round}라운드`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER' && (
            <RoundTimer endsAt={room.phaseEndsAt} />
          )}
          {user && (
            <span className="text-sm text-neutral-400">
              {(user.prefs as { nickname?: string }).nickname || user.name || user.email}
            </span>
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
        <WaitingRoom
          room={room}
          viewerId={viewerId}
          onStart={handleStart}
          startError={actionError}
          onToggleReady={handleToggleReady}
          onKick={handleKick}
          onSend={handleSend}
          onCopyInvite={() => pushToast('코드가 복사되었습니다')}
          chatMutedUntil={chatMutedUntil}
        />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
          <PlayerSidebar room={room} viewerId={viewerId} />
          <div className="flex min-h-0 flex-col gap-4">
            <TopicBanner topic={room.topic} />
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
                disabled={!self?.isAlive || room.phase !== 'DISCUSSION' || chatMutedUntil !== null}
                onSend={handleSend}
              />
            )}
          </div>
        </div>
      )}

      {room.phase === 'ROUND_RESULT' && roundResult && <RoundResultModal result={roundResult} />}
      {room.phase === 'GAME_OVER' && gameOver && (
        <GameOverModal
          payload={gameOver}
          onLeave={handleLeave}
          onReturnToLobby={handleReturnToLobby}
          isHost={room.hostId === viewerId}
        />
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
          title={
            room.phase !== 'LOBBY'
              ? '게임이 진행 중이에요. 정말 나가시겠어요? 나가면 1분간 이 방에 다시 들어올 수 없어요.'
              : '정말 방을 나가시겠어요?'
          }
          confirmLabel="나가기"
          onConfirm={handleLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
      {needsNickname && (
        <SetNicknameModal suggested={nicknameSuggestion} onSubmit={handleSetNickname} />
      )}
      {chatMutedUntil !== null && (
        <ChatMuteModal mutedUntil={chatMutedUntil} onClose={() => setChatMutedUntil(null)} />
      )}
      {profanityWarning && (
        <AlertModal title={profanityWarning} onClose={() => setProfanityWarning(null)} />
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
