import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import type { Message, MessagesPage, Participant, PlaybackState, Room, You } from '@/api/types';
import type { PlayerAdapter } from '@/player/types';

import type {
  ConnectionStatus,
  FatalConnectionReason,
  ServerEvent,
  WsErrorPayload,
} from './protocol';
import { RealtimeSocket } from './socket';
import { PlaybackSyncEngine } from './syncEngine';

export interface ChatEntry extends Message {
  pending?: boolean;
  failed?: boolean;
}

export interface UseRoomRealtimeOptions {
  roomCode: string;
  wsBaseUrl: string;
  getTicket: () => Promise<{ ticket: string }>;
  player: PlayerAdapter | null;
  enabled?: boolean;
  selfDisplayName: string;
  loadHistory?: (beforeMessageId: number, limit: number) => Promise<MessagesPage>;
  onRoomClosed?: (closedAt: string) => void;
}

export interface RoomRealtime {
  status: ConnectionStatus;
  room: Room | null;
  playback: PlaybackState | null;
  participants: Participant[];
  messages: ChatEntry[];
  you: You | null;
  error: WsErrorPayload | null;
  fatalReason: FatalConnectionReason | null;
  roomClosedAt: string | null;
  hasMoreHistory: boolean;
  loadingHistory: boolean;
  needsGesture: boolean;
  sendPlaybackCommand: (action: 'play' | 'pause' | 'seek', positionSeconds: number) => void;
  requestSync: () => void;
  sendChatMessage: (text: string) => string | null;
  changeVideo: (videoUrl: string) => boolean;
  loadOlderMessages: () => Promise<void>;
  resumePlayback: () => void;
  clearError: () => void;
}

interface RealtimeState {
  status: ConnectionStatus;
  room: Room | null;
  playback: PlaybackState | null;
  participants: Participant[];
  messages: ChatEntry[];
  you: You | null;
  error: WsErrorPayload | null;
  fatalReason: FatalConnectionReason | null;
  roomClosedAt: string | null;
  hasMoreHistory: boolean;
  loadingHistory: boolean;
  needsGesture: boolean;
}

interface PlaybackAnchorSnapshot {
  state: PlaybackState;
  serverTime: string;
}

const HISTORY_PAGE_SIZE = 50;
const MAX_CHAT_TEXT = 500;

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toWsError(code: string, message: string, details: unknown = null): WsErrorPayload {
  return { code, message, details };
}

function wsErrorFromUnknown(error: unknown): WsErrorPayload {
  if (error instanceof ApiError) {
    return toWsError(error.code, error.message, error.details);
  }
  return toWsError('internal_error', 'Unexpected client error');
}

function notConnectedError(): WsErrorPayload {
  return toWsError('not_connected', 'WebSocket is not connected');
}

function isUnconfirmed(entry: ChatEntry): boolean {
  return entry.pending === true || entry.failed === true || entry.message_id <= 0;
}

function mergeIncomingMessage(current: ChatEntry[], incoming: Message): ChatEntry[] {
  const withoutMatchingPending = current.filter(
    (entry) =>
      !(
        isUnconfirmed(entry) &&
        incoming.client_message_id !== null &&
        entry.client_message_id === incoming.client_message_id
      ),
  );
  if (withoutMatchingPending.some((entry) => entry.message_id === incoming.message_id)) {
    return withoutMatchingPending;
  }

  const confirmed = [
    ...withoutMatchingPending.filter((entry) => !isUnconfirmed(entry)),
    incoming,
  ].sort((left, right) => left.message_id - right.message_id);
  const unconfirmed = withoutMatchingPending.filter(isUnconfirmed);
  return [...confirmed, ...unconfirmed];
}

function initialState(enabled: boolean): RealtimeState {
  return {
    status: enabled ? 'connecting' : 'closed',
    room: null,
    playback: null,
    participants: [],
    messages: [],
    you: null,
    error: null,
    fatalReason: null,
    roomClosedAt: null,
    hasMoreHistory: false,
    loadingHistory: false,
    needsGesture: false,
  };
}

export function useRoomRealtime({
  roomCode,
  wsBaseUrl,
  getTicket,
  player,
  enabled = true,
  selfDisplayName,
  loadHistory,
  onRoomClosed,
}: UseRoomRealtimeOptions): RoomRealtime {
  const [state, setState] = useState<RealtimeState>(() => initialState(enabled));
  const stateRef = useRef(state);
  stateRef.current = state;

  const socketRef = useRef<RealtimeSocket | null>(null);
  const engineRef = useRef<PlaybackSyncEngine | null>(null);
  const latestPlaybackRef = useRef<PlaybackAnchorSnapshot | null>(null);
  const getTicketRef = useRef(getTicket);
  const selfNameRef = useRef(selfDisplayName);
  const onRoomClosedRef = useRef(onRoomClosed);

  useEffect(() => {
    getTicketRef.current = getTicket;
  }, [getTicket]);

  useEffect(() => {
    selfNameRef.current = selfDisplayName;
  }, [selfDisplayName]);

  useEffect(() => {
    onRoomClosedRef.current = onRoomClosed;
  }, [onRoomClosed]);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case 'room.snapshot': {
        const payload = event.payload;
        latestPlaybackRef.current = {
          state: payload.playback,
          serverTime: event.server_time,
        };
        setState((previous) => ({
          ...previous,
          room: payload.room,
          playback: payload.playback,
          participants: payload.participants,
          messages: payload.messages,
          you: payload.you,
          hasMoreHistory: payload.messages.length >= HISTORY_PAGE_SIZE,
          needsGesture: false,
          error: null,
        }));
        engineRef.current?.applyRemotePlayback(payload.playback, event.server_time);
        if (payload.room.status === 'closed') {
          const closedAt = payload.room.closed_at ?? new Date().toISOString();
          onRoomClosedRef.current?.(closedAt);
        }
        break;
      }
      case 'playback.state': {
        const payload = event.payload;
        const current = latestPlaybackRef.current;
        if (current && payload.playback.revision < current.state.revision) {
          break;
        }
        latestPlaybackRef.current = {
          state: payload.playback,
          serverTime: event.server_time,
        };
        setState((previous) => ({ ...previous, playback: payload.playback }));
        engineRef.current?.applyRemotePlayback(payload.playback, event.server_time);
        break;
      }
      case 'chat.message': {
        const incoming = event.payload.message;
        setState((previous) => ({
          ...previous,
          messages: mergeIncomingMessage(previous.messages, incoming),
        }));
        break;
      }
      case 'participant.joined':
      case 'participant.left': {
        const participants = event.payload.participants;
        setState((previous) => ({ ...previous, participants }));
        break;
      }
      case 'room.closed': {
        const closedAt = event.payload.closed_at;
        setState((previous) => ({
          ...previous,
          roomClosedAt: closedAt,
          status: 'closed',
          room: previous.room
            ? { ...previous.room, status: 'closed', closed_at: closedAt }
            : previous.room,
        }));
        onRoomClosedRef.current?.(closedAt);
        break;
      }
      case 'error': {
        const payload = event.payload;
        setState((previous) => ({ ...previous, error: payload }));
        break;
      }
      case 'pong':
      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const socket = new RealtimeSocket({
      roomCode,
      wsBaseUrl,
      getTicket: () => getTicketRef.current(),
      onEvent: (event) => handleServerEvent(event as ServerEvent),
      onStatus: (status) => {
        setState((previous) => (previous.status === status ? previous : { ...previous, status }));
      },
      onFatal: (reason) => {
        setState((previous) => ({ ...previous, fatalReason: reason }));
        if (reason === 'room_closed') {
          onRoomClosedRef.current?.(stateRef.current.roomClosedAt ?? new Date().toISOString());
        }
      },
    });
    socketRef.current = socket;
    socket.start();

    return () => {
      socket.stop();
      socketRef.current = null;
    };
  }, [enabled, handleServerEvent, roomCode, wsBaseUrl]);

  useEffect(() => {
    if (!player) {
      return;
    }
    const engine = new PlaybackSyncEngine(player, {
      sendCommand: (action, positionSeconds) => {
        const socket = socketRef.current;
        if (
          !socket?.send('playback.command', {
            action,
            position_seconds: positionSeconds,
          })
        ) {
          setState((previous) =>
            previous.error ? previous : { ...previous, error: notConnectedError() },
          );
        }
      },
      requestSync: () => {
        socketRef.current?.send('playback.sync.request', {});
      },
      onPlaybackBlocked: (blocked) => {
        setState((previous) =>
          previous.needsGesture === blocked ? previous : { ...previous, needsGesture: blocked },
        );
      },
    });
    engineRef.current = engine;

    const latest = latestPlaybackRef.current;
    if (latest) {
      engine.applyRemotePlayback(latest.state, latest.serverTime);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [player]);

  const sendPlaybackCommand = useCallback(
    (action: 'play' | 'pause' | 'seek', positionSeconds: number) => {
      const socket = socketRef.current;
      if (!socket?.send('playback.command', { action, position_seconds: positionSeconds })) {
        setState((previous) => ({ ...previous, error: notConnectedError() }));
      }
    },
    [],
  );

  const requestSync = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.send('room.sync.request', {})) {
      setState((previous) => ({ ...previous, error: notConnectedError() }));
    }
  }, []);

  const sendChatMessage = useCallback(
    (text: string): string | null => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MAX_CHAT_TEXT) {
        return null;
      }

      const socket = socketRef.current;
      if (!socket?.isOpen()) {
        setState((previous) => ({ ...previous, error: notConnectedError() }));
        return null;
      }

      const current = stateRef.current;
      const clientMessageId = createUuid();
      const optimistic: ChatEntry = {
        message_id: -Date.now(),
        room_code: roomCode,
        participant_id: current.you?.participant_id ?? 'self',
        display_name: selfNameRef.current,
        text: trimmed,
        created_at: new Date().toISOString(),
        client_message_id: clientMessageId,
        pending: true,
      };
      setState((previous) => ({ ...previous, messages: [...previous.messages, optimistic] }));

      const sent = socket.send(
        'chat.send',
        { text: trimmed, client_message_id: clientMessageId },
        createUuid(),
      );
      if (!sent) {
        setState((previous) => ({
          ...previous,
          error: notConnectedError(),
          messages: previous.messages.map((entry) =>
            entry.client_message_id === clientMessageId
              ? { ...entry, pending: false, failed: true }
              : entry,
          ),
        }));
      }
      return clientMessageId;
    },
    [roomCode],
  );

  const changeVideo = useCallback((videoUrl: string): boolean => {
    const socket = socketRef.current;
    if (!socket) {
      setState((previous) => ({ ...previous, error: notConnectedError() }));
      return false;
    }
    const sent = socket.send('video.change', { video_url: videoUrl }, createUuid());
    if (!sent) {
      setState((previous) => ({ ...previous, error: notConnectedError() }));
    }
    return sent;
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const current = stateRef.current;
    if (!loadHistory || current.loadingHistory || !current.hasMoreHistory) {
      return;
    }
    const firstMessage = current.messages.find((entry) => entry.message_id > 0);
    if (!firstMessage) {
      setState((previous) => ({ ...previous, hasMoreHistory: false }));
      return;
    }

    setState((previous) => ({ ...previous, loadingHistory: true }));
    try {
      const page = await loadHistory(firstMessage.message_id, HISTORY_PAGE_SIZE);
      setState((previous) => {
        const known = new Set(previous.messages.map((entry) => entry.message_id));
        const older = page.messages.filter((entry) => !known.has(entry.message_id));
        const confirmed = [
          ...older,
          ...previous.messages.filter((entry) => !isUnconfirmed(entry)),
        ].sort((left, right) => left.message_id - right.message_id);
        const unconfirmed = previous.messages.filter(isUnconfirmed);
        return {
          ...previous,
          messages: [...confirmed, ...unconfirmed],
          hasMoreHistory: page.has_more,
          loadingHistory: false,
        };
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loadingHistory: false,
        error: wsErrorFromUnknown(error),
      }));
    }
  }, [loadHistory]);

  const resumePlayback = useCallback(() => {
    engineRef.current?.retryPlay();
  }, []);

  const clearError = useCallback(() => {
    setState((previous) => (previous.error ? { ...previous, error: null } : previous));
  }, []);

  return {
    status: state.status,
    room: state.room,
    playback: state.playback,
    participants: state.participants,
    messages: state.messages,
    you: state.you,
    error: state.error,
    fatalReason: state.fatalReason,
    roomClosedAt: state.roomClosedAt,
    hasMoreHistory: state.hasMoreHistory,
    loadingHistory: state.loadingHistory,
    needsGesture: state.needsGesture,
    sendPlaybackCommand,
    requestSync,
    sendChatMessage,
    changeVideo,
    loadOlderMessages,
    resumePlayback,
    clearError,
  };
}
