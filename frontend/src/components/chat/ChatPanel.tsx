import { useRef } from 'react';

import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { ChatEntry } from '@/realtime/useRoomRealtime';

import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

export interface ChatPanelProps {
  messages: ChatEntry[];
  youId: string | null;
  connected: boolean;
  roomClosed: boolean;
  hasMoreHistory: boolean;
  loadingHistory: boolean;
  onLoadOlder: () => void;
  onSend: (text: string) => string | null;
}

export function ChatPanel({
  messages,
  youId,
  connected,
  roomClosed,
  hasMoreHistory,
  loadingHistory,
  onLoadOlder,
  onSend,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleScroll = useAutoScroll(scrollRef, messages.length);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Чат</h2>
        <span className="text-xs text-slate-400">{messages.length} сообщ.</span>
      </div>
      <MessageList
        messages={messages}
        youId={youId}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        hasMore={hasMoreHistory}
        loadingOlder={loadingHistory}
        onLoadOlder={onLoadOlder}
      />
      <MessageInput disabled={!connected || roomClosed} onSend={onSend} />
    </section>
  );
}
