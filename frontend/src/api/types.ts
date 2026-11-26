export type RoomStatus = 'active' | 'closed';
export type ParticipantRole = 'owner' | 'member';

export interface Room {
  room_code: string;
  title: string | null;
  status: RoomStatus;
  max_participants: number;
  created_at: string;
  closed_at: string | null;
}

export interface Participant {
  participant_id: string;
  display_name: string;
  role: ParticipantRole;
  is_online: boolean;
  joined_at: string;
}

export interface PlaybackState {
  video_id: string | null;
  video_url: string | null;
  is_playing: boolean;
  position_seconds: number;
  updated_at: string;
  revision: number;
  updated_by_participant_id: string | null;
}

export interface Message {
  message_id: number;
  room_code: string;
  participant_id: string;
  display_name: string;
  text: string;
  created_at: string;
  client_message_id: string | null;
}

export interface You {
  participant_id: string;
  role: ParticipantRole;
}

export interface RoomDetail {
  room: Room;
  playback: PlaybackState;
  participants: Participant[];
  you: You;
}

export interface RoomDetailWithToken extends RoomDetail {
  access_token: string;
}

export interface MessagesPage {
  messages: Message[];
  has_more: boolean;
}

export interface WsTicket {
  ticket: string;
  expires_at: string;
}

export interface CreateRoomInput {
  display_name: string;
  title?: string | null;
  video_url?: string | null;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}
