'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, Check, CheckCheck, Package, AlertTriangle, TrendingDown, X } from 'lucide-react';
import Link from 'next/link';

const API_URL = 'http://localhost:3000';

function getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

type Notification = {
    id: number;
    type: string;
    title: string;
    message: string;
    is_read: number;
    product_id: number | null;
    created_at: string;
};

function timeAgo(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}s`;
    return `${Math.floor(diff / 86400)}g`;
}

function getIcon(type: string) {
    switch (type) {
        case 'stock_available': return <Package className="w-4 h-4 text-emerald-500" />;
        case 'stock_unavailable': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
        case 'price_alert': return <TrendingDown className="w-4 h-4 text-amber-500" />;
        default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
}

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 15000);
        return () => clearInterval(interval);
    }, []);

    // Close on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    async function fetchCount() {
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const unread = data.filter((n: any) => n.is_read === 0).length;
                setUnreadCount(unread);
                setNotifications(data.slice(0, 10)); // Keep a few
            }
        } catch { }
    }

    async function fetchNotifications() {
        try {
            const res = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                setUnreadCount(data.filter((n: any) => n.is_read === 0).length);
            }
        } catch { }
    }

    async function markAllRead() {
        try {
            await fetch(`${API_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: getAuthHeaders(),
            });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch { }
    }

    async function markAsRead(id: number) {
        try {
            await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'PUT',
                headers: getAuthHeaders(),
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { }
    }

    function toggleOpen() {
        if (!open) fetchNotifications();
        setOpen(!open);
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={toggleOpen}
                className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-500 transition-colors relative"
            >
                <span className="sr-only">Bildirimler</span>
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-10 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Bildirimler</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Tümünü Okundu Yap
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                Henüz bildirim yok
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`px-4 py-3 hover:bg-slate-50 transition-colors ${n.is_read === 0 ? 'bg-indigo-50/30' : ''}`}
                                >
                                    {n.product_id ? (
                                        <Link
                                            href={`/products/${n.product_id}`}
                                            onClick={() => {
                                                setOpen(false);
                                                if (n.is_read === 0) markAsRead(n.id);
                                            }}
                                            className="block"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">{getIcon(n.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm font-medium ${n.is_read === 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                                                            {n.title}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 ml-2 shrink-0">{timeAgo(n.created_at)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                                                </div>
                                                {n.is_read === 0 && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                                            </div>
                                        </Link>
                                    ) : (
                                        <div
                                            className="flex items-start gap-3 cursor-pointer"
                                            onClick={() => {
                                                if (n.is_read === 0) markAsRead(n.id);
                                            }}
                                        >
                                            <div className="mt-0.5">{getIcon(n.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-sm font-medium ${n.is_read === 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                                                        {n.title}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 ml-2 shrink-0">{timeAgo(n.created_at)}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                                            </div>
                                            {n.is_read === 0 && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
