'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, Package, TrendingDown, ShieldCheck, ShieldX, Clock, ArrowUpRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { API_URL, getAuthHeaders, getProxyImageUrl } from '@/lib/api';

type DashboardData = {
  totalProducts: number;
  inStockCount: number;
  outOfStockCount: number;
  priceDrops: Array<{ id: number; url: string; store: string; name: string | null; image_url: string | null; current_price: number; previous_price: number; drop_amount: number }>;
  recentChanges: Array<{ id: number; url: string; store: string; name: string | null; image_url: string | null; in_stock: number; price: number | null; checked_at: string; source: string }>;
  checksToday: number;
  cronExpr: string;
};

function getLabel(item: { name: string | null; url: string }): string {
  if (item.name) return item.name;
  try {
    const path = new URL(item.url).pathname;
    return path.split('/').filter(s => s.length > 3).slice(-1)[0]?.replace(/-/g, ' ').replace(/p \d+$/, '').trim() || item.url;
  } catch { return item.url; }
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchDashboard() {
    const token = sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/dashboard`, { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('token');
          router.push('/login');
          return;
        }
        throw new Error('API Error');
      }
      setData(await res.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-medium text-slate-800 mb-4">Oturum Süreniz Doldu</h2>
        <Link href="/login" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
          Tekrar Giriş Yap
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
        <p className="text-sm font-medium">Dashboard yükleniyor...</p>
      </div>
    );
  }

  const stats = [
    { name: 'Toplam Ürün', value: data?.totalProducts ?? 0, icon: Package, color: 'indigo' },
    { name: 'Stokta', value: data?.inStockCount ?? 0, icon: ShieldCheck, color: 'emerald' },
    { name: 'Tükenen', value: data?.outOfStockCount ?? 0, icon: ShieldX, color: 'rose' },
    { name: 'Bugünkü Kontrol', value: data?.checksToday ?? 0, icon: Activity, color: 'violet' },
  ];

  const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
    indigo: { bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', text: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', text: 'text-emerald-600' },
    rose: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', text: 'text-rose-600' },
    violet: { bg: 'bg-violet-50', iconBg: 'bg-violet-100', text: 'text-violet-600' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">
            Hoş geldin{user?.name ? `, ${user.name}` : ''}! Sistemin güncel durumu aşağıda.
          </p>
        </div>
        <Link
          href="/add"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-medium text-sm shadow-sm"
        >
          Yeni Takip Başlat
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <div key={stat.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">{stat.name}</span>
                <div className={`p-2.5 rounded-xl ${colors.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${colors.text}`} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-slate-900">{stat.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Drops */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-semibold text-slate-900">Fiyatı Düşenler (24 Saat)</h3>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {data?.priceDrops && data.priceDrops.length > 0 ? (
              data.priceDrops.map((drop) => (
                <div key={drop.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
                    {drop.image_url && (
                      <img src={drop.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-100" />
                    )}
                    <div className="min-w-0">
                      <Link href={`/products/${drop.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600 truncate block">
                        {getLabel(drop)}
                      </Link>
                      <span className="text-xs text-slate-400 capitalize">{drop.store}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-600">-{drop.drop_amount.toFixed(2)} ₺</span>
                    <div className="text-xs text-slate-400">{drop.current_price.toFixed(2)} ₺</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                Son 24 saatte fiyat düşüşü tespit edilmedi.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-500" />
              <h3 className="text-base font-semibold text-slate-900">Son Kontroller</h3>
            </div>
            <Link href="/products" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1">
              Tümü <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {data?.recentChanges && data.recentChanges.length > 0 ? (
              data.recentChanges.map((change, i) => (
                <div key={i} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                    {change.in_stock === 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    {change.image_url && (
                      <img src={getProxyImageUrl(change.image_url)} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-100" />
                    )}
                    <div className="min-w-0">
                      <Link href={`/products/${change.id}`} className="text-sm text-slate-700 hover:text-indigo-600 truncate block">
                        {getLabel(change)}
                      </Link>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {change.price != null && (
                      <span className="text-sm font-medium text-slate-900">{change.price.toFixed(2)} ₺</span>
                    )}
                    <div className="text-xs text-slate-400">
                      {new Date(change.checked_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                Son 24 saatte kontrol kaydı yok.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
