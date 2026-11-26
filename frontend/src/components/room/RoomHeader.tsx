import { useState } from 'react';

import type { Room } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/hooks/useToast';
import { copyToClipboard } from '@/lib/clipboard';
import { buildInviteUrl } from '@/lib/env';

export interface RoomHeaderProps {
  room: Room;
  onlineCount: number;
  totalCount: number;
  isOwner: boolean;
  busy: boolean;
  onCloseRoom: () => void;
  onLeave: () => void;
}

export function RoomHeader({
  room,
  onlineCount,
  totalCount,
  isOwner,
  busy,
  onCloseRoom,
  onLeave,
}: RoomHeaderProps) {
  const [confirm, setConfirm] = useState<'close' | 'leave' | null>(null);
  const { notify } = useToast();
  const closed = room.status === 'closed';

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(buildInviteUrl(room.room_code));
    notify(
      ok ? 'Ссылка-приглашение скопирована.' : 'Не удалось скопировать ссылку.',
      ok ? 'success' : 'error',
    );
  };

  return (
    <div className="border-b border-white/5 bg-slate-950/30">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">
              {room.title || 'Комната просмотра'}
            </h1>
            {closed ? (
              <Badge variant="closed">Закрыта</Badge>
            ) : (
              <Badge variant="online">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Активна
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400">
            <code className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono tracking-wider text-slate-300">
              {room.room_code}
            </code>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <Icon name="link" size={14} />
              Скопировать ссылку
            </button>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="users" size={14} />
              {onlineCount} из {totalCount} онлайн
            </span>
          </div>
        </div>

        {!closed ? (
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Button
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => setConfirm('close')}
                leftIcon={<Icon name="close" size={15} />}
              >
                Закрыть комнату
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={busy}
                onClick={() => setConfirm('leave')}
                leftIcon={<Icon name="logout" size={15} />}
              >
                Выйти
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <Dialog
        open={confirm === 'close'}
        title="Закрыть комнату?"
        description="Все участники будут отключены, а комната станет недоступна для просмотра. Действие нельзя отменить."
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                setConfirm(null);
                onCloseRoom();
              }}
            >
              Закрыть комнату
            </Button>
          </>
        }
      />

      <Dialog
        open={confirm === 'leave'}
        title="Выйти из комнаты?"
        description="Вы сможете вернуться по ссылке, пока комната открыта и есть свободные места."
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Остаться
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                setConfirm(null);
                onLeave();
              }}
            >
              Выйти
            </Button>
          </>
        }
      />
    </div>
  );
}
