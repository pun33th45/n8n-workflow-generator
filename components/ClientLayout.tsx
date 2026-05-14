'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ToastProvider } from './ToastProvider';
import Sidebar from './Sidebar';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname === '/onboarding' || pathname?.startsWith('/onboarding/');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    window.electronAPI.hasApiKey().then(hasKey => {
      if (!hasKey && !isOnboarding) {
        router.push('/onboarding');
      } else if (hasKey && isOnboarding) {
        router.push('/');
      }
    });
  }, [pathname, router, isOnboarding]);

  if (isOnboarding) {
    return (
      <ToastProvider>
        <div className="h-screen">{children}</div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
    </ToastProvider>
  );
}
