import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { formatDateTime } from '@/lib/format';

export interface RoomClosedNoticeProps {
  closedAt: string | null;
}

export function RoomClosedNotice({ closedAt }: RoomClosedNoticeProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
        <Icon name="alert" size={30} />
      </span>
      <h1 className="mt-6 text-2xl font-semibold text-white">Комната закрыта</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        Владелец завершил совместный просмотр. Воспроизведение остановлено, новые сообщения
        отправить нельзя.
      </p>
      {closedAt ? (
        <p className="mt-3 text-xs text-slate-500">Закрыта {formatDateTime(closedAt)}</p>
      ) : null}
      <Button
        className="mt-8"
        onClick={() => navigate('/')}
        leftIcon={<Icon name="arrow-left" size={16} />}
      >
        На главную
      </Button>
    </div>
  );
}
