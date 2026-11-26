import type { ReactNode } from 'react';

import { ToastProvider } from '@/hooks/useToast';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
