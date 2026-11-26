import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const BOTTOM_THRESHOLD_PX = 80;

export function useAutoScroll<T extends HTMLElement>(
  targetRef: RefObject<T | null>,
  dependency: unknown,
): () => void {
  const stickToBottom = useRef(true);

  useEffect(() => {
    const element = targetRef.current;
    if (element && stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [dependency, targetRef]);

  return useCallback(() => {
    const element = targetRef.current;
    if (!element) {
      return;
    }
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_THRESHOLD_PX;
  }, [targetRef]);
}
