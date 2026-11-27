import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <span className="font-mono text-6xl font-semibold text-slate-700">404</span>
      <h1 className="mt-4 text-2xl font-semibold text-white">Страница не найдена</h1>
      <p className="mt-2 text-sm text-slate-400">
        Возможно, ссылка устарела или комната была закрыта. Вернитесь на главную и создайте новую.
      </p>
      <Button
        className="mt-8"
        onClick={() => navigate('/')}
        leftIcon={<Icon name="arrow-left" size={16} />}
      >
        На главную
      </Button>
    </div>
  );
}
