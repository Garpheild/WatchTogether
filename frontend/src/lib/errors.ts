const MESSAGES: Record<string, string> = {
  validation_error: 'Проверьте введённые данные.',
  invalid_token: 'Сессия недействительна. Войдите в комнату заново.',
  forbidden: 'Недостаточно прав для этого действия.',
  room_not_found: 'Комната не найдена. Проверьте ссылку или код.',
  room_closed: 'Комната уже закрыта.',
  room_full: 'В комнате нет свободных мест.',
  name_taken: 'Это имя уже занято. Выберите другое.',
  owner_must_close: 'Владелец должен закрыть комнату, а не выходить из неё.',
  rate_limited: 'Слишком много запросов. Подождите немного и попробуйте снова.',
  internal_error: 'Ошибка на сервере. Попробуйте позже.',
  network_error: 'Нет связи с сервером. Проверьте подключение к сети.',
  not_connected: 'Нет соединения с комнатой. Подождите восстановления.',
  stale_position: 'Позиция воспроизведения устарела, синхронизируем комнату.',
  video_not_set: 'Сначала выберите видео.',
  unsupported_event: 'Сервер не поддерживает это действие.',
  sync_too_frequent: 'Синхронизация запрашивается слишком часто.',
};

export function describeErrorCode(code: string): string {
  return MESSAGES[code] ?? 'Что-то пошло не так. Попробуйте ещё раз.';
}

export function extractFieldErrors(details: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!details || typeof details !== 'object') {
    return result;
  }

  const fields = (details as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) {
    return result;
  }

  for (const entry of fields) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    const reason = (entry as { reason?: unknown }).reason;
    if (typeof field === 'string' && typeof reason === 'string' && !result[field]) {
      result[field] = reason;
    }
  }

  return result;
}
