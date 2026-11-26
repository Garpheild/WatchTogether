import type { PlaybackState } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { PlayerAdapter } from '@/player/types';
import { YouTubePlayer } from '@/player/YouTubePlayer';
import { canonicalYouTubeUrl } from '@/lib/youtube';

import { OwnerControls } from './OwnerControls';

export interface VideoStageProps {
  playback: PlaybackState | null;
  isOwner: boolean;
  roomClosed: boolean;
  needsGesture: boolean;
  playerError: string | null;
  onChangeVideo: (videoUrl: string) => boolean;
  onPlayerReady: (adapter: PlayerAdapter | null) => void;
  onEmbedError: (message: string) => void;
  onResumePlayback: () => void;
}

export function VideoStage({
  playback,
  isOwner,
  roomClosed,
  needsGesture,
  playerError,
  onChangeVideo,
  onPlayerReady,
  onEmbedError,
  onResumePlayback,
}: VideoStageProps) {
  const videoId = playback?.video_id ?? null;
  const hasVideo = videoId !== null;

  return (
    <section className="flex flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
        {hasVideo ? (
          <YouTubePlayer onReady={onPlayerReady} onEmbedError={onEmbedError} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_45%,rgba(99,102,241,0.18),transparent_55%)] px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-indigo-200">
              <Icon name="video" size={26} />
            </span>
            <div>
              <p className="text-base font-medium text-white">Видео ещё не выбрано</p>
              <p className="mt-1 text-sm text-slate-400">
                {isOwner
                  ? 'Добавьте ссылку на YouTube, чтобы начать совместный просмотр.'
                  : 'Подождите, пока владелец комнаты добавит видео.'}
              </p>
            </div>
            {isOwner && !roomClosed ? (
              <OwnerControls
                onChangeVideo={onChangeVideo}
                label="Добавить видео"
                variant="primary"
              />
            ) : null}
          </div>
        )}

        {hasVideo && playerError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-8 text-center">
            <Icon name="alert" size={30} className="text-amber-300" />
            <p className="max-w-md text-sm text-slate-200">{playerError}</p>
            {isOwner && !roomClosed ? (
              <OwnerControls onChangeVideo={onChangeVideo} label="Выбрать другое видео" />
            ) : null}
          </div>
        ) : null}

        {hasVideo && needsGesture && !playerError && !roomClosed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 px-6 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="max-w-sm text-sm text-slate-200">
                Браузер заблокировал автоматическое воспроизведение.
              </p>
              <Button onClick={onResumePlayback} leftIcon={<Icon name="play" size={16} />}>
                Нажать, чтобы синхронизироваться
              </Button>
            </div>
          </div>
        ) : null}

        {roomClosed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-6 text-center">
            <Icon name="alert" size={28} className="text-rose-300" />
            <p className="text-sm font-medium text-white">Комната закрыта</p>
            <p className="max-w-sm text-xs text-slate-400">
              Воспроизведение остановлено. Спасибо за просмотр!
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {playback ? (
            <Badge variant={playback.is_playing ? 'online' : 'muted'}>
              <Icon name={playback.is_playing ? 'play' : 'pause'} size={12} />
              {playback.is_playing ? 'Воспроизведение' : 'Пауза'}
            </Badge>
          ) : (
            <Badge variant="muted">Состояние загружается</Badge>
          )}
          {hasVideo ? (
            <a
              href={canonicalYouTubeUrl(videoId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="link" size={12} />
              Открыть на YouTube
            </a>
          ) : null}
        </div>

        {isOwner && hasVideo && !roomClosed ? (
          <OwnerControls onChangeVideo={onChangeVideo} />
        ) : null}
      </div>
    </section>
  );
}
