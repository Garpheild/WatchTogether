import { Outlet } from 'react-router-dom';

import { Footer } from './Footer';
import { Header } from './Header';

export function AppShell() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_-10%,rgba(79,70,229,0.18),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.14),transparent_40%),radial-gradient(circle_at_50%_120%,rgba(168,85,247,0.12),transparent_45%)]"
      />
      <Header />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
