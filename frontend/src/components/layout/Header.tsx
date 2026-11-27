import { Link } from 'react-router-dom';

import { Icon } from '@/components/ui/Icon';

export function Header() {
  return (
    <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-950/40">
            <Icon name="play" size={18} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-white">Watch Party</span>
            <span className="text-[11px] text-slate-400">Смотрите YouTube вместе</span>
          </span>
        </Link>
        <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Гостевой доступ
        </span>
      </div>
    </header>
  );
}
