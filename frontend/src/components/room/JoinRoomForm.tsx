import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { describeErrorCode, extractFieldErrors } from '@/lib/errors';

export interface JoinRoomFormProps {
  roomCode: string;
  suggestedName?: string;
  busy: boolean;
  error: ApiError | null;
  onJoin: (displayName: string) => Promise<boolean>;
}

export function JoinRoomForm({
  roomCode,
  suggestedName = '',
  busy,
  error,
  onJoin,
}: JoinRoomFormProps) {
  const [displayName, setDisplayName] = useState(suggestedName);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(suggestedName);
  }, [suggestedName]);

  const fieldErrors = error ? extractFieldErrors(error.details) : {};
  const nameError = validationError ?? fieldErrors.display_name;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 32) {
      setValidationError('Имя должно содержать от 1 до 32 символов.');
      return;
    }
    setValidationError(null);
    await onJoin(trimmed);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="default" className="font-mono tracking-wider">
            {roomCode}
          </Badge>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200"
          >
            <Icon name="arrow-left" size={14} />
            На главную
          </Link>
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-white">Вход в комнату</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Представьтесь, чтобы другие участники видели, кто смотрит вместе с ними. Аккаунт не нужен.
        </p>

        {error && error.code !== 'invalid_token' ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200">
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>{describeErrorCode(error.code)}</span>
          </div>
        ) : null}

        {error?.code === 'invalid_token' ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-100">
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>Срок действия прошлой сессии истёк. Войдите в комнату заново.</span>
          </div>
        ) : null}

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Ваше имя"
            value={displayName}
            maxLength={32}
            autoFocus
            autoComplete="nickname"
            placeholder="Например, Борис"
            onChange={(event) => {
              setDisplayName(event.target.value);
              if (validationError) {
                setValidationError(null);
              }
            }}
            error={nameError}
            hint="От 1 до 32 символов. Имя должно быть уникальным в комнате."
          />
          <Button
            type="submit"
            size="lg"
            loading={busy}
            fullWidth
            leftIcon={<Icon name="sparkles" />}
          >
            Войти в комнату
          </Button>
        </form>
      </div>
    </div>
  );
}
