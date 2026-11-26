import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'online' | 'owner' | 'muted' | 'closed' | 'danger';

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-white/10 bg-white/5 text-slate-200',
  online: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  owner: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
  muted: 'border-white/10 bg-white/5 text-slate-400',
  closed: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  danger: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
