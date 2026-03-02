'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, TrendingUp, TrendingDown, Clock, Activity, Bell, Loader2, Store } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_URL, getAuthHeaders } from '@/lib/api';

type AnalyticsData = {
    priceIncreases: Array<{ id: number; url: string; store: string; current_price: number; previous_price: number; change_amount: number; change_percent: number }>;
    priceDecreases: Array<{ id: number; url: string; store: string; current_price: number; previous_price: number; change_amount: number; change_percent: number }>;
    totalChecks: number;
    checks24h: number;
    dailyChecks: Array<{ day: string; count: number }>;
    storeDistribution: Array<{ store: string; count: number }>;
    activeAlerts: number;
};

export default function StatsPage() {
    const router = useRouter();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    async function fetchAnalytics() {
        const token = sessionStorage.getItem('token');
        if (!token) { router.push('/login'); return; }
        try {
            const res = await fetch(`${API_URL}/admin/analytics`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('API Error');
            setData(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const summaryStats = [
        { name: 'Toplam Kontrol', value: data?.totalChecks ?? 0, icon: BarChart3, color: 'bg-indigo-50 text-indigo-600' },
        { name: 'Son 24 Saat', value: data?.checks24h ?? 0, icon: Clock, color: 'bg-violet-50 text-violet-600' },
        { name: 'Aktif Alarm', value: data?.activeAlerts ?? 0, icon: Bell, color: 'bg-amber-50 text-amber-600' },
        { name: 'Mağaza Sayısı', value: data?.storeDistribution?.length ?? 0, icon: Store, color: 'bg-emerald-50 text-emerald-600' },
    ];

    return (
        <div className="space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">İstatistikler</h1>
                <p className="text-sm text-slate-500 mt-1">Sistemin performans ve takip istatistikleri</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryStats.map((stat) => (
                    <div key={stat.name} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-500 mt-2">{stat.name}</span>
                        <span className="text-2xl font-bold text-slate-900">{stat.value.toLocaleString('tr-TR')}</span>
                    </div>
                ))}
            </div>

            {/* Daily Checks Chart */}
            {data?.dailyChecks && data.dailyChecks.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-base font-semibold text-slate-900">Günlük Kontrol Sayısı (Son 7 Gün)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data.dailyChecks}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                                dataKey="day"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
                                }}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                labelFormatter={(val) => new Date(val).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                formatter={(value: number | string | undefined) => [value, 'Kontrol']}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                            />
                            <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Price Increases */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-rose-500" />
                        <h3 className="text-base font-semibold text-slate-900">En Çok Fiyatı Artanlar</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {data?.priceIncreases && data.priceIncreases.length > 0 ? (
                            data.priceIncreases.map((item) => (
                                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <Link href={`/products/${item.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600 truncate block">
                                            {item.url.replace(/https?:\/\/(www\.)?/, '').substring(0, 45)}...
                                        </Link>
                                        <span className="text-xs text-slate-400 capitalize">{item.store}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-sm font-bold text-rose-600">+%{item.change_percent}</span>
                                        <div className="text-xs text-slate-400">+{item.change_amount.toFixed(2)} ₺</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-slate-400">Fiyat artışı bulunamadı.</div>
                        )}
                    </div>
                </div>

                {/* Price Decreases */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-base font-semibold text-slate-900">En Çok Fiyatı Düşenler</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {data?.priceDecreases && data.priceDecreases.length > 0 ? (
                            data.priceDecreases.map((item) => (
                                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <Link href={`/products/${item.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600 truncate block">
                                            {item.url.replace(/https?:\/\/(www\.)?/, '').substring(0, 45)}...
                                        </Link>
                                        <span className="text-xs text-slate-400 capitalize">{item.store}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-sm font-bold text-emerald-600">-%{item.change_percent}</span>
                                        <div className="text-xs text-slate-400">-{item.change_amount.toFixed(2)} ₺</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-slate-400">Fiyat düşüşü bulunamadı.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Store Distribution */}
            {data?.storeDistribution && data.storeDistribution.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Store className="w-5 h-5 text-violet-500" />
                        <h3 className="text-base font-semibold text-slate-900">Mağaza Dağılımı</h3>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {data.storeDistribution.map((s) => (
                            <div key={s.store} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                <span className="text-sm font-medium text-slate-700 capitalize">{s.store}</span>
                                <span className="text-sm font-bold text-indigo-600">{s.count} ürün</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
