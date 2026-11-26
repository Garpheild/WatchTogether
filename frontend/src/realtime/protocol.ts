import type { Message, Participant, ParticipantRole, PlaybackState, Room } from '@/api/types';

export const SERVER_EVENTS = {
  roomSnapshot: 'room.snapshot',
  playbackState: 'playback.state',
  chatMessage: 'chat.message',
  participantJoined: 'participant.joined',
  participantLeft: 'participant.left',
  roomClosed: 'room.closed',
  pong: 'pong',
  error: 'error',
} as const;

export const CLIENT_EVENTS = {
  roomSyncRequest: 'room.sync.request',
  playbackCommand: 'playback.command',
  playbackSyncRequest: 'playback.sync.request',
  videoChange: 'video.change',
  chatSend: 'chat.send',
  ping: 'ping',
} as const;

export interface ServerEnvelope<T = unknown> {
  type: string;
  event_id: string;
  room_code: string;
  server_time: string;
  request_id: string | null;
  payload: T;
}

export interface ClientEnvelope<T = unknown> {
  type: string;
  request_id?: string;
  payload: T;
}

export interface RoomSnapshotPayload {
  room: Room;
  playback: PlaybackState;
  participants: Participant[];
  messages: Message[];
  you: { participant_id: string; role: ParticipantRole };
}

export type PlaybackReason = 'command' | 'video_change' | 'sync_request';

export interface PlaybackStatePayload {
  reason: PlaybackReason;
  playback: PlaybackState;
}

export interface ChatMessagePayload {
  message: Message;
}

export interface ParticipantJoinedPayload {
  participant: Participant;
  participants: Participant[];
}

export interface ParticipantLeftPayload {
  participant_id: string;
  participants: Participant[];
}

export interface RoomClosedPayload {
  room_code: string;
  closed_at: string;
  closed_by_participant_id: string;
}

export type WsErrorPayload = {
  code: string;
  message: string;
  details: unknown;
};

export interface PongPayload {
  client_time: string | null;
}

export type ServerEvent =
  | (ServerEnvelope<RoomSnapshotPayload> & { type: 'room.snapshot' })
  | (ServerEnvelope<PlaybackStatePayload> & { type: 'playback.state' })
  | (ServerEnvelope<ChatMessagePayload> & { type: 'chat.message' })
  | (ServerEnvelope<ParticipantJoinedPayload> & { type: 'participant.joined' })
  | (ServerEnvelope<ParticipantLeftPayload> & { type: 'participant.left' })
  | (ServerEnvelope<RoomClosedPayload> & { type: 'room.closed' })
  | (ServerEnvelope<PongPayload> & { type: 'pong' })
  | (ServerEnvelope<WsErrorPayload> & { type: 'error' });

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

export type FatalConnectionReason =
  'invalid_token' | 'forbidden' | 'room_not_found' | 'room_closed' | 'rate_limited';

export interface PlaybackCommandPayload {
  action: 'play' | 'pause' | 'seek';
  position_seconds: number;
}

export interface ChatSendPayload {
  text: string;
  client_message_id: string;
}

export interface VideoChangePayload {
  video_url: string;
}

export interface PingPayload {
  client_time: string;
}

export const WS_CLOSE_CODES = {
  normal: 1000,
  goingAway: 1001,
  policyViolation: 1008,
  messageTooBig: 1009,
  serviceRestart: 1012,
  invalidTicket: 4401,
  forbidden: 4403,
  roomNotFound: 4404,
  roomClosed: 4409,
  rateLimited: 4429,
} as const;
