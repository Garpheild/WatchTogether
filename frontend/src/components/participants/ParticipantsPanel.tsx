import { useMemo } from 'react';

import type { Participant } from '@/api/types';
import { Icon } from '@/components/ui/Icon';

import { ParticipantItem } from './ParticipantItem';

export interface ParticipantsPanelProps {
  participants: Participant[];
  youId: string | null;
  maxParticipants?: number;
}

export function ParticipantsPanel({
  participants,
  youId,
  maxParticipants,
}: ParticipantsPanelProps) {
  const sorted = useMemo(() => {
    return [...participants].sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === 'owner' ? -1 : 1;
      }
      if (left.is_online !== right.is_online) {
        return left.is_online ? -1 : 1;
      }
      return Date.parse(left.joined_at) - Date.parse(right.joined_at);
    });
  }, [participants]);

  const online = sorted.filter((participant) => participant.is_online).length;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <Icon name="users" size={16} />
          Участники
        </h2>
        <span className="text-xs text-slate-400">
          {online}/{sorted.length}
          {maxParticipants ? ` · лимит ${maxParticipants}` : ''}
        </span>
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {sorted.map((participant) => (
          <ParticipantItem
            key={participant.participant_id}
            participant={participant}
            isYou={participant.participant_id === youId}
          />
        ))}
      </ul>
    </section>
  );
}
