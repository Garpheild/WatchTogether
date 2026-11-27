import { useEffect, useRef } from 'react';

import { createYouTubePlayer } from './YouTubePlayerAdapter';
import type { YouTubePlayerAdapter } from './YouTubePlayerAdapter';
import type { PlayerAdapter } from './types';

export interface YouTubePlayerProps {
  onReady: (adapter: PlayerAdapter | null) => void;
  onEmbedError?: (message: string) => void;
}

export function YouTubePlayer({ onReady, onEmbedError }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onEmbedErrorRef = useRef(onEmbedError);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onEmbedErrorRef.current = onEmbedError;
  }, [onEmbedError]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    let adapter: YouTubePlayerAdapter | null = null;

    createYouTubePlayer(host, {
      onError: (message) => onEmbedErrorRef.current?.(message),
    })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        adapter = created;
        onReadyRef.current(created);
      })
      .catch(() => {
        if (!disposed) {
          onEmbedErrorRef.current?.(
            'Не удалось загрузить плеер YouTube. Проверьте подключение к сети и обновите страницу.',
          );
          onReadyRef.current(null);
        }
      });

    return () => {
      disposed = true;
      adapter?.destroy();
      adapter = null;
      onReadyRef.current(null);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" />;
}
