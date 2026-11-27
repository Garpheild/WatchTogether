import type { RefObject } from 'react';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { ChatEntry } from '@/realtime/useRoomRealtime';

import { MessageItem } from './MessageItem';

export interface MessageListProps {
  messages: ChatEntry[];
  youId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

export function MessageList({
  messages,
  youId,
  scrollRef,
  onScroll,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: MessageListProps) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 space-y-1 overflow-y-auto px-2 py-3"
      role="log"
      aria-live="polite"
    >
      {hasMore ? (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            loading={loadingOlder}
            onClick={onLoadOlder}
            leftIcon={loadingOlder ? undefined : <Icon name="refresh" size={14} />}
          >
            Загрузить историю
          </Button>
        </div>
      ) : null}

      {messages.length === 0 ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
          <Icon name="chat" size={28} className="text-slate-600" />
          <p className="text-sm text-slate-400">
            Сообщений пока нет. Напишите первым — начнём обсуждение.
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={message.client_message_id ?? `message-${message.message_id}`}
            message={message}
            isOwn={message.participant_id === youId}
          />
        ))
      )}
    </div>
  );
}
