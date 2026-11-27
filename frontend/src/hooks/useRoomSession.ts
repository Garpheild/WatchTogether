import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { closeRoom, getRoom, joinRoom, leaveRoom } from '@/api/rooms';
import type { RoomDetail } from '@/api/types';
import {
  clearAccessToken,
  getAccessToken,
  getDisplayName,
  setAccessToken,
  setDisplayName,
} from '@/lib/storage';

export type RoomSessionStatus = 'loading' | 'needs_join' | 'ready' | 'error';

export interface RoomSession {
  status: RoomSessionStatus;
  detail: RoomDetail | null;
  error: ApiError | null;
  token: string | null;
  busy: boolean;
  suggestedName: string;
  join: (displayName: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  leave: () => Promise<void>;
  closeRoom: () => Promise<void>;
  forget: () => void;
  markClosed: (closedAt: string) => void;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError('network_error', 'Network request failed', 0, null);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useRoomSession(roomCode: string): RoomSession {
  const [status, setStatus] = useState<RoomSessionStatus>('loading');
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [token, setToken] = useState<string | null>(() => getAccessToken(roomCode));
  const [busy, setBusy] = useState(false);
  const [suggestedName, setSuggestedName] = useState(() => getDisplayName(roomCode) ?? '');

  useEffect(() => {
    const existingToken = getAccessToken(roomCode);
    setToken(existingToken);
    setSuggestedName(getDisplayName(roomCode) ?? '');
    setDetail(null);
    setError(null);

    if (!existingToken) {
      setStatus('needs_join');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');

    getRoom(roomCode, existingToken, controller.signal)
      .then((roomDetail) => {
        setDetail(roomDetail);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) {
          return;
        }
        const apiError = toApiError(caught);
        if (apiError.code === 'invalid_token' || apiError.code === 'forbidden') {
          clearAccessToken(roomCode);
          setToken(null);
          setStatus('needs_join');
          setError(apiError);
          return;
        }
        setStatus('error');
        setError(apiError);
      });

    return () => {
      controller.abort();
    };
  }, [roomCode]);

  const join = useCallback(
    async (displayName: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const roomDetail = await joinRoom(roomCode, displayName);
        setAccessToken(roomCode, roomDetail.access_token);
        setDisplayName(roomCode, displayName);
        setToken(roomDetail.access_token);
        setDetail(roomDetail);
        setStatus('ready');
        return true;
      } catch (caught) {
        setError(toApiError(caught));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [roomCode],
  );

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const roomDetail = await getRoom(roomCode, token);
      setDetail(roomDetail);
      if (status !== 'ready') {
        setStatus('ready');
      }
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.code === 'invalid_token' || apiError.code === 'forbidden') {
        clearAccessToken(roomCode);
        setToken(null);
        setStatus('needs_join');
      }
      setError(apiError);
    }
  }, [roomCode, status, token]);

  const leave = useCallback(async () => {
    if (!token) {
      setStatus('needs_join');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await leaveRoom(roomCode, token);
      clearAccessToken(roomCode);
      setToken(null);
      setDetail(null);
      setStatus('needs_join');
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.code === 'invalid_token' || apiError.code === 'forbidden') {
        clearAccessToken(roomCode);
        setToken(null);
        setDetail(null);
        setStatus('needs_join');
      }
      setError(apiError);
    } finally {
      setBusy(false);
    }
  }, [roomCode, token]);

  const close = useCallback(async () => {
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await closeRoom(roomCode, token);
      const closedAt = new Date().toISOString();
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              room: { ...previous.room, status: 'closed', closed_at: closedAt },
            }
          : previous,
      );
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }, [roomCode, token]);

  const forget = useCallback(() => {
    clearAccessToken(roomCode);
    setToken(null);
    setDetail(null);
    setError(null);
    setStatus('needs_join');
  }, [roomCode]);

  const markClosed = useCallback((closedAt: string) => {
    setDetail((previous) =>
      previous
        ? {
            ...previous,
            room: { ...previous.room, status: 'closed', closed_at: closedAt },
          }
        : previous,
    );
  }, []);

  return {
    status,
    detail,
    error,
    token,
    busy,
    suggestedName,
    join,
    refresh,
    leave,
    closeRoom: close,
    forget,
    markClosed,
  };
}
