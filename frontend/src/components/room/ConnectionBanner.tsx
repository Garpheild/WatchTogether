import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { describeErrorCode } from '@/lib/errors';
import type { ConnectionStatus, FatalConnectionReason } from '@/realtime/protocol';

export interface ConnectionBannerProps {
  status: ConnectionStatus;
  fatalReason: FatalConnectionReason | null;
  onRejoin: () => void;
}

function fatalMessage(reason: FatalConnectionReason | null): string {
  if (!reason) {
    return 'Соединение с комнатой потеряно.';
  }
  return describeErrorCode(reason);
}

export function ConnectionBanner({ status, fatalReason, onRejoin }: ConnectionBannerProps) {
  if (status === 'open' || status === 'closed') {
    return null;
  }

  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-2.5 border-b border-white/5 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-100 sm:px-6">
        <Spinner size="sm" />
        Подключение к комнате…
      </div>
    );
  }

  if (status === 'reconnecting') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100 sm:px-6">
        <span className="inline-flex items-center gap-2">
          <Icon name="wifi-off" size={16} />
          Соединение потеряно. Переподключаемся автоматически…
        </span>
        <button
          type="button"
          className="text-xs font-medium text-amber-200 underline-offset-2 hover:underline"
          onClick={() => window.location.reload()}
        >
          Обновить страницу
        </button>
      </div>
    );
  }

  const canRejoin = fatalReason === 'invalid_token' || fatalReason === 'forbidden';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100 sm:px-6">
      <span className="inline-flex items-center gap-2">
        <Icon name="alert" size={16} />
        {fatalMessage(fatalReason)}
      </span>
      {canRejoin ? (
        <Button size="sm" variant="secondary" onClick={onRejoin}>
          Войти заново
        </Button>
      ) : (
        <Link
          to="/"
          className="text-xs font-medium text-rose-200 underline-offset-2 hover:underline"
        >
          На главную
        </Link>
      )}
    </div>
  );
}
