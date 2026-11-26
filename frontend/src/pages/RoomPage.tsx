import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { getMessages, requestWsTicket } from '@/api/rooms';
import type { MessagesPage } from '@/api/types';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ParticipantsPanel } from '@/components/participants/ParticipantsPanel';
import { ConnectionBanner } from '@/components/room/ConnectionBanner';
import { JoinRoomForm } from '@/components/room/JoinRoomForm';
import { RoomClosedNotice } from '@/components/room/RoomClosedNotice';
import { RoomHeader } from '@/components/room/RoomHeader';
import { VideoStage } from '@/components/room/VideoStage';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useRoomSession } from '@/hooks/useRoomSession';
import type { RoomSession } from '@/hooks/useRoomSession';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { WS_BASE_URL } from '@/lib/env';
import { describeErrorCode } from '@/lib/errors';
import { normalizeRoomCode } from '@/lib/room';
import { getDisplayName } from '@/lib/storage';
import type { PlayerAdapter } from '@/player/types';
import { useRoomRealtime } from '@/realtime/useRoomRealtime';

import { NotFoundPage } from './NotFoundPage';

export function RoomPage() {
  const params = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const normalizedCode = params.roomCode ? normalizeRoomCode(params.roomCode) : null;
  const roomCode = normalizedCode ?? params.roomCode ?? '';
  const session = useRoomSession(roomCode);

  if (!params.roomCode || !normalizedCode) {
    return <NotFoundPage />;
  }

  if (session.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
          <Spinner size="lg" className="text-indigo-300" />
          Загружаем комнату…
        </div>
      </div>
    );
  }

  if (session.status === 'needs_join') {
    return (
      <JoinRoomForm
        roomCode={roomCode}
        suggestedName={session.suggestedName}
        busy={session.busy}
        error={session.error}
        onJoin={session.join}
      />
    );
  }

  if (session.status === 'error' || !session.detail) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
          <Icon name="alert" size={26} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-white">
          {session.error?.code === 'room_not_found'
            ? 'Комната не найдена'
            : 'Не удалось открыть комнату'}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {describeErrorCode(session.error?.code ?? 'internal_error')}
        </p>
        <div className="mt-6 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            leftIcon={<Icon name="arrow-left" size={16} />}
          >
            На главную
          </Button>
          <Button
            onClick={() => void session.refresh()}
            leftIcon={<Icon name="refresh" size={16} />}
          >
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  return <RoomView key={roomCode} roomCode={roomCode} session={session} />;
}

interface RoomViewProps {
  roomCode: string;
  session: RoomSession;
}

function RoomView({ roomCode, session }: RoomViewProps) {
  const detail = session.detail;
  if (!detail) {
    return null;
  }

  return (
    <RoomViewContent roomCode={roomCode} session={session} detail={detail} token={session.token} />
  );
}

interface RoomViewContentProps {
  roomCode: string;
  session: RoomSession;
  detail: NonNullable<RoomSession['detail']>;
  token: string | null;
}

function RoomViewContent({ roomCode, session, detail, token }: RoomViewContentProps) {
  const { notify } = useToast();
  const [player, setPlayer] = useState<PlayerAdapter | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [tab, setTab] = useState<'chat' | 'participants'>('chat');

  const loadHistory = useCallback(
    async (beforeMessageId: number, limit: number): Promise<MessagesPage> => {
      if (!token) {
        throw new ApiError('invalid_token', 'Missing access token', 401, null);
      }
      return getMessages(roomCode, token, { beforeId: beforeMessageId, limit });
    },
    [roomCode, token],
  );

  const getTicket = useCallback(async (): Promise<{ ticket: string }> => {
    if (!token) {
      throw new ApiError('invalid_token', 'Missing access token', 401, null);
    }
    const response = await requestWsTicket(roomCode, token);
    return { ticket: response.ticket };
  }, [roomCode, token]);

  const markClosed = session.markClosed;
  const handleRoomClosed = useCallback(
    (closedAt: string) => {
      markClosed(closedAt);
    },
    [markClosed],
  );

  const selfParticipant = detail.participants.find(
    (participant) => participant.participant_id === detail.you.participant_id,
  );
  const selfName = selfParticipant?.display_name ?? getDisplayName(roomCode) ?? 'Вы';

  const realtime = useRoomRealtime({
    roomCode,
    wsBaseUrl: WS_BASE_URL,
    getTicket,
    player,
    enabled: detail.room.status === 'active' && Boolean(token),
    selfDisplayName: selfName,
    loadHistory,
    onRoomClosed: handleRoomClosed,
  });

  const room = realtime.room ?? detail.room;
  const participants = realtime.you ? realtime.participants : detail.participants;
  const you = realtime.you ?? detail.you;
  const playback = realtime.playback ?? detail.playback;
  const closedAt = realtime.roomClosedAt ?? room.closed_at;
  const closed = room.status === 'closed' || realtime.roomClosedAt !== null;
  const isOwner = you.role === 'owner';
  const onlineCount = participants.filter((participant) => participant.is_online).length;
  const realtimeError = realtime.error;
  const clearError = realtime.clearError;

  useEffect(() => {
    setPlayerError(null);
  }, [playback.video_id]);

  useEffect(() => {
    if (!realtimeError) {
      return;
    }
    notify(describeErrorCode(realtimeError.code), 'error');
    clearError();
  }, [clearError, notify, realtimeError]);

  useEffect(() => {
    if (!session.error) {
      return;
    }
    notify(describeErrorCode(session.error.code), 'error');
  }, [notify, session.error]);

  return (
    <div className="flex flex-1 flex-col">
      <RoomHeader
        room={room}
        onlineCount={onlineCount}
        totalCount={participants.length}
        isOwner={isOwner}
        busy={session.busy}
        onCloseRoom={() => void session.closeRoom()}
        onLeave={() => void session.leave()}
      />
      <ConnectionBanner
        status={realtime.status}
        fatalReason={realtime.fatalReason}
        onRejoin={session.forget}
      />

      {closed ? (
        <RoomClosedNotice closedAt={closedAt} />
      ) : (
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <VideoStage
              playback={playback}
              isOwner={isOwner}
              roomClosed={closed}
              needsGesture={realtime.needsGesture}
              playerError={playerError}
              onChangeVideo={realtime.changeVideo}
              onPlayerReady={setPlayer}
              onEmbedError={setPlayerError}
              onResumePlayback={realtime.resumePlayback}
            />

            <aside className="flex h-[70vh] min-h-0 flex-col gap-3 lg:sticky lg:top-4 lg:h-[calc(100vh-10rem)]">
              <div className="flex rounded-xl border border-white/10 bg-slate-900/50 p-1">
                <button
                  type="button"
                  onClick={() => setTab('chat')}
                  aria-pressed={tab === 'chat'}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                    tab === 'chat'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <Icon name="chat" size={16} />
                  Чат
                  <span className="text-xs text-slate-500">{realtime.messages.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('participants')}
                  aria-pressed={tab === 'participants'}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                    tab === 'participants'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <Icon name="users" size={16} />
                  Участники
                  <span className="text-xs text-slate-500">{participants.length}</span>
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <div className={cn('absolute inset-0 flex', tab === 'chat' ? '' : 'hidden')}>
                  <ChatPanel
                    messages={realtime.messages}
                    youId={you.participant_id}
                    connected={realtime.status === 'open'}
                    roomClosed={closed}
                    hasMoreHistory={realtime.hasMoreHistory}
                    loadingHistory={realtime.loadingHistory}
                    onLoadOlder={() => void realtime.loadOlderMessages()}
                    onSend={realtime.sendChatMessage}
                  />
                </div>
                <div
                  className={cn('absolute inset-0 flex', tab === 'participants' ? '' : 'hidden')}
                >
                  <ParticipantsPanel
                    participants={participants}
                    youId={you.participant_id}
                    maxParticipants={room.max_participants}
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
