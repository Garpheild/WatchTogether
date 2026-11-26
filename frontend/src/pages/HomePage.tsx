import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { createRoom } from '@/api/rooms';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { describeErrorCode, extractFieldErrors } from '@/lib/errors';
import { normalizeRoomCode } from '@/lib/room';
import { setAccessToken, setDisplayName as persistDisplayName } from '@/lib/storage';
import { extractYouTubeVideoId } from '@/lib/youtube';

interface FormErrors {
  display_name?: string;
  title?: string;
  video_url?: string;
  generic?: string;
}

export function HomePage() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [creating, setCreating] = useState(false);

  const [joinValue, setJoinValue] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedTitle = title.trim();
    const trimmedVideo = videoUrl.trim();

    const nextErrors: FormErrors = {};
    if (trimmedName.length < 1 || trimmedName.length > 32) {
      nextErrors.display_name = 'Имя должно содержать от 1 до 32 символов.';
    }
    if (trimmedTitle.length > 80) {
      nextErrors.title = 'Название комнаты не длиннее 80 символов.';
    }
    if (trimmedVideo && !extractYouTubeVideoId(trimmedVideo)) {
      nextErrors.video_url = 'Не удалось распознать ссылку на YouTube.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setCreating(true);
    try {
      const created = await createRoom({
        display_name: trimmedName,
        title: trimmedTitle || null,
        video_url: trimmedVideo || null,
      });
      setAccessToken(created.room.room_code, created.access_token);
      persistDisplayName(created.room.room_code, trimmedName);
      navigate(`/r/${created.room.room_code}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldErrors = extractFieldErrors(caught.details);
        setErrors({
          display_name: fieldErrors.display_name,
          title: fieldErrors.title,
          video_url: fieldErrors.video_url,
          generic: describeErrorCode(caught.code),
        });
      } else {
        setErrors({ generic: describeErrorCode('network_error') });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeRoomCode(joinValue);
    if (!code) {
      setJoinError('Введите код комнаты или вставьте ссылку-приглашение.');
      return;
    }
    setJoinError(null);
    navigate(`/r/${code}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <Badge variant="owner" className="mx-auto">
          <Icon name="sparkles" size={13} />
          Совместный просмотр без регистрации
        </Badge>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Смотрите YouTube вместе,
          <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
            {' '}
            где бы вы ни были
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-400">
          Создайте комнату, отправьте ссылку друзьям и смотрите видео синхронно. Плеер, чат и список
          участников работают в одном окне — без аккаунтов и установки.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            До 10 участников
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Синхронизация play / pause / seek
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Чат и онлайн-статусы
          </span>
        </div>
      </section>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/20">
              <Icon name="video" size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Создать комнату</h2>
              <p className="text-xs text-slate-400">
                Вы станете владельцем и сможете менять видео.
              </p>
            </div>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleCreate}>
            <Input
              label="Ваше имя"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={32}
              autoComplete="nickname"
              placeholder="Например, Аня"
              error={errors.display_name}
            />
            <Input
              label="Название комнаты"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="Вечерний просмотр"
              error={errors.title}
              hint="Необязательно"
            />
            <Input
              label="Ссылка на YouTube"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              error={errors.video_url}
              hint="Можно оставить пустым и выбрать видео позже."
            />

            {errors.generic ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200">
                <Icon name="alert" size={16} className="mt-0.5" />
                <span>{errors.generic}</span>
              </div>
            ) : null}

            <Button type="submit" size="lg" loading={creating} leftIcon={<Icon name="sparkles" />}>
              Создать комнату
            </Button>
          </form>
        </section>

        <section className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20">
              <Icon name="link" size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Войти по приглашению</h2>
              <p className="text-xs text-slate-400">Есть код или ссылка от друга? Всё просто.</p>
            </div>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleJoin}>
            <Input
              label="Код комнаты или ссылка"
              value={joinValue}
              onChange={(event) => {
                setJoinValue(event.target.value);
                if (joinError) {
                  setJoinError(null);
                }
              }}
              placeholder="k7m2p9qx или https://…/r/k7m2p9qx"
              error={joinError ?? undefined}
              hint="Имя мы спросим на следующем шаге."
            />
            <Button
              type="submit"
              size="lg"
              variant="secondary"
              leftIcon={<Icon name="arrow-left" />}
            >
              Перейти к входу
            </Button>
          </form>

          <div className="mt-auto pt-8">
            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-400">
              <p className="font-medium text-slate-300">Как это работает</p>
              <ul className="mt-2 space-y-1.5">
                <li>1. Владелец создаёт комнату и выбирает видео.</li>
                <li>2. Участники открывают ссылку и вводят имя.</li>
                <li>3. Play, pause и перемотка синхронизируются у всех.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
