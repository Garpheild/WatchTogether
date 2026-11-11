import { Button } from '@/components/Button';

export function HomePage() {
  return (
    <section className="card">
      <h2>Страницы</h2>
      <p>Каркас готов: React + TypeScript + Vite + ESLint + Prettier.</p>
      <Button onClick={() => console.warn('Кнопка работает')}>Проверить</Button>
    </section>
  );
}
