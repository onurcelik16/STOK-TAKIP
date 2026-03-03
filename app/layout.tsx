'use client';

import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/landing';
  const isVerifyPage = pathname === '/verify';

  // Verification & Auth Guard (Disabled by user request)
  useEffect(() => {
    if (isPublicPage) return;

    const token = sessionStorage.getItem('token');
    const userStr = sessionStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/login');
    }
  }, [pathname, isPublicPage]);

  const isFullPage = isPublicPage || isVerifyPage;

  return (
    <html lang="tr" className="h-full bg-slate-50">
      <head>
        <title>Stock Tracker | Profesyonel Yönetim</title>
      </head>
      <body className="h-full font-sans antialiased text-slate-600">
        {isFullPage ? (
          children
        ) : (
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 w-full lg:pl-64">
              <Header />
              <main className="flex-1 overflow-y-auto w-full">
                <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                  {children}
                </div>
              </main>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}

