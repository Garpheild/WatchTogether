/**
 * Слой `framework` — каркасные, платформо-независимые вещи:
 * константы приложения, обёртки над браузерными/платформенными API,
 * базовые абстракции (http-клиент, storage, logger), которые используют
 * `src` и `native`. Никакой бизнес-логики и никакого UI здесь быть не должно.
 */
export const APP_NAME = 'WatchTogether';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}
