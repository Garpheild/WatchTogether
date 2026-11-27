import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { extractYouTubeVideoId } from '@/lib/youtube';

export interface OwnerControlsProps {
  onChangeVideo: (videoUrl: string) => boolean;
  disabled?: boolean;
  label?: string;
  variant?: 'primary' | 'secondary';
}

export function OwnerControls({
  onChangeVideo,
  disabled = false,
  label = 'Сменить видео',
  variant = 'secondary',
}: OwnerControlsProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setError('Вставьте ссылку на видео YouTube.');
      return;
    }
    if (!extractYouTubeVideoId(trimmed)) {
      setError('Не удалось распознать ссылку. Используйте youtube.com/watch?v=… или youtu.be/…');
      return;
    }
    setError(null);
    const sent = onChangeVideo(trimmed);
    if (!sent) {
      setError('Нет соединения с комнатой. Попробуйте ещё раз.');
      return;
    }
    setVideoUrl('');
    setOpen(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        leftIcon={<Icon name="video" size={15} />}
      >
        {label}
      </Button>

      <Dialog
        open={open}
        title="Сменить видео"
        description="Новое видео загрузится у всех участников в режиме паузы. Ссылку можно вставить в любом поддерживаемом формате YouTube."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                const form = document.getElementById(formId) as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              Загрузить видео
            </Button>
          </>
        }
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Ссылка на YouTube"
            autoFocus
            value={videoUrl}
            onChange={(event) => {
              setVideoUrl(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            error={error ?? undefined}
            hint="Поддерживаются watch, youtu.be, shorts, live, embed и music.youtube.com."
          />
        </form>
      </Dialog>
    </>
  );
}
