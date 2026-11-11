import { APP_NAME, formatDateTime } from '@framework/index';
import { HomePage } from '@/pages/HomePage';

export function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1>{APP_NAME}</h1>
        <p className="app__hint">Собрано: {formatDateTime(new Date())}</p>
      </header>

      <HomePage />
    </main>
  );
}
