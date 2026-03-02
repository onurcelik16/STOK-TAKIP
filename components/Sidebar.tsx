'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, Settings, BarChart2, LogOut, Menu, X, Users, Shield, Wrench } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ürünler', href: '/products', icon: Package },
  { name: 'İstatistikler', href: '/stats', icon: BarChart2 },
  { name: 'Kullanıcılar', href: '/admin/users', icon: Users, adminOnly: true },
  { name: 'Sistem Ayarları', href: '/admin/settings', icon: Wrench, adminOnly: true },
  { name: 'Ayarlar', href: '/settings', icon: Settings },
];

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);

  // Listen on custom event
  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener('toggle-sidebar', handler);
    return () => window.removeEventListener('toggle-sidebar', handler);
  }, []);

  return null; // Rendering is handled via the layout
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Read role from sessionStorage on client only (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) {
        const role = JSON.parse(stored)?.role;
        setIsAdmin(role === 'admin');
      }
    } catch { }
  }, [pathname]); // Re-check on route change

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/');
    router.refresh();
  };

  const visibleNav = navigation.filter(item => !(item as any).adminOnly || isAdmin);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between h-16 border-b border-slate-800 bg-slate-950 px-4">
        <Link href="/dashboard">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-500" />
            Stock<span className="text-indigo-500">Tracker</span>
          </h1>
        </Link>
        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-3 space-y-1">
          {visibleNav
            .map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200'
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300',
                      'mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 mb-3 rounded-lg text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 transition-colors border border-rose-400/20"
        >
          <LogOut className="w-4 h-4" /> Çıkış Yap
        </button>
        <UserInfo />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900 border-r border-slate-800 h-screen fixed top-0 left-0">
        {sidebarContent}
      </div>
    </>
  );
}

function UserInfo() {
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || 'Kullanıcı';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const role = user?.role || 'user';

  return (
    <div className="flex items-center gap-3 px-2">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
        {initials}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-white truncate">{displayName}</span>
        <span className="text-xs text-slate-500 capitalize">{role === 'admin' ? '🛡️ Admin' : '👤 Kullanıcı'}</span>
      </div>
    </div>
  );
}
