import { apiRequest } from './client';
import type {
  CreateRoomInput,
  MessagesPage,
  RoomDetail,
  RoomDetailWithToken,
  WsTicket,
} from './types';

function roomPath(roomCode: string, suffix = ''): string {
  return `/rooms/${encodeURIComponent(roomCode)}${suffix}`;
}

export function createRoom(input: CreateRoomInput): Promise<RoomDetailWithToken> {
  return apiRequest<RoomDetailWithToken>('/rooms', {
    method: 'POST',
    body: {
      display_name: input.display_name,
      title: input.title ?? null,
      video_url: input.video_url ?? null,
    },
  });
}

export function joinRoom(roomCode: string, displayName: string): Promise<RoomDetailWithToken> {
  return apiRequest<RoomDetailWithToken>(roomPath(roomCode, '/join'), {
    method: 'POST',
    body: { display_name: displayName },
  });
}

export function getRoom(
  roomCode: string,
  token: string,
  signal?: AbortSignal,
): Promise<RoomDetail> {
  return apiRequest<RoomDetail>(roomPath(roomCode), { token, signal });
}

export interface MessageHistoryOptions {
  limit?: number;
  beforeId?: number;
}

export function getMessages(
  roomCode: string,
  token: string,
  options: MessageHistoryOptions = {},
): Promise<MessagesPage> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 50));
  if (options.beforeId !== undefined) {
    params.set('before_id', String(options.beforeId));
  }
  return apiRequest<MessagesPage>(`${roomPath(roomCode, '/messages')}?${params.toString()}`, {
    token,
  });
}

export function requestWsTicket(roomCode: string, token: string): Promise<WsTicket> {
  return apiRequest<WsTicket>(roomPath(roomCode, '/ws-ticket'), {
    method: 'POST',
    token,
  });
}

export function leaveRoom(roomCode: string, token: string): Promise<void> {
  return apiRequest<void>(roomPath(roomCode, '/leave'), {
    method: 'POST',
    token,
  });
}

export function closeRoom(roomCode: string, token: string): Promise<void> {
  return apiRequest<void>(roomPath(roomCode), {
    method: 'DELETE',
    token,
  });
}
