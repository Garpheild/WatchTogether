import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export interface MessageInputProps {
  disabled: boolean;
  placeholder?: string;
  onSend: (text: string) => string | null;
}

const MAX_LENGTH = 500;

export function MessageInput({
  disabled,
  placeholder = 'Написать сообщение…',
  onSend,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) {
      return;
    }
    const result = onSend(text);
    if (result !== null) {
      setText('');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-white/5 p-2.5"
      aria-label="Отправка сообщения"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          placeholder={disabled ? 'Чат недоступен' : placeholder}
          aria-label="Текст сообщения"
          className="max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button
          type="submit"
          size="md"
          disabled={!canSend}
          className="h-11 w-11 shrink-0 px-0"
          aria-label="Отправить сообщение"
        >
          <Icon name="send" size={18} />
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-slate-500">
        <span>Enter — отправить, Shift+Enter — новая строка</span>
        {text.length > MAX_LENGTH - 100 ? (
          <span>
            {text.length}/{MAX_LENGTH}
          </span>
        ) : null}
      </div>
    </form>
  );
}
