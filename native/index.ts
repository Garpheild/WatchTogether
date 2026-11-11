/**
 * Слой `native` — код, разделяемый с нативными клиентами
 * (React Native / мобильный WebView). Пока это заглушка:
 * здесь появятся мосты, типы событий плеера и платформенные адаптеры.
 */
export type Platform = 'web' | 'android' | 'ios';

export const currentPlatform: Platform = 'web';
