export const APP_NAME = 'WatchTogether';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}
