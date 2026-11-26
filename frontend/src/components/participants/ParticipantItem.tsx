import type { Participant } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { avatarPalette, formatDateTime, getInitials } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface ParticipantItemProps {
  participant: Participant;
  isYou: boolean;
}

export function ParticipantItem({ participant, isYou }: ParticipantItemProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5">
      <span
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1',
          avatarPalette(participant.participant_id),
        )}
        aria-hidden="true"
      >
        {getInitials(participant.display_name)}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900',
            participant.is_online ? 'bg-emerald-400' : 'bg-slate-500',
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-200">
            {participant.display_name}
          </span>
          {isYou ? <Badge variant="owner">Вы</Badge> : null}
          {participant.role === 'owner' ? <Badge variant="owner">Владелец</Badge> : null}
        </div>
        <p className="text-[11px] text-slate-500" title={participant.joined_at}>
          {participant.is_online ? 'В сети' : 'Не в сети'} · с{' '}
          {formatDateTime(participant.joined_at)}
        </p>
      </div>
    </li>
  );
}
