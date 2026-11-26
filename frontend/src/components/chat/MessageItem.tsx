import { Badge } from '@/components/ui/Badge';
import type { ChatEntry } from '@/realtime/useRoomRealtime';
import { avatarPalette, formatMessageTime, getInitials } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface MessageItemProps {
  message: ChatEntry;
  isOwn: boolean;
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  return (
    <article
      className={cn(
        'flex gap-2.5 rounded-xl px-2.5 py-2 transition-colors',
        isOwn && 'bg-indigo-500/10',
        message.pending && 'opacity-70',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1',
          avatarPalette(message.participant_id),
        )}
        aria-hidden="true"
      >
        {getInitials(message.display_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-slate-200">{message.display_name}</span>
          {isOwn ? <Badge variant="owner">Вы</Badge> : null}
          <time
            className="text-[11px] text-slate-500"
            dateTime={message.created_at}
            title={message.created_at}
          >
            {formatMessageTime(message.created_at)}
          </time>
          {message.failed ? <span className="text-[11px] text-rose-300">не отправлено</span> : null}
          {message.pending ? <span className="text-[11px] text-slate-500">отправка…</span> : null}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
          {message.text}
        </p>
      </div>
    </article>
  );
}
