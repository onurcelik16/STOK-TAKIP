'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { ArrowLeft, Clock, ExternalLink, Activity, DollarSign, PackageCheck, AlertCircle, Bell, BellRing, Trash2, Plus, Target, Loader2, Pencil, Save, X, Download } from 'lucide-react';
import { API_URL, getAuthHeaders, getProxyImageUrl } from '@/lib/api';

type HistoryEntry = {
  id: number;
  in_stock: number;
  price: number | null;
  checked_at: string;
  source: string | null;
};

type CurrentStatus = {
  value: boolean;
  method: string;
  samples: Array<{ in_stock: number; source: string | null; checked_at: string }>;
};

type PriceAlert = {
  id: number;
  target_price: number;
  direction: string;
  is_active: number;
  created_at: string;
  triggered_at: string | null;
};

type ProductDetail = {
  product: {
    id: number;
    url: string;
    store: string;
    selector: string | null;
    name: string | null;
    image_url: string | null;
    category: string | null;
    tags: string | null;
    created_at: string;
  };
  history: HistoryEntry[];
  current_status: CurrentStatus | null;
};

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Price Alert State
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'below' | 'above'>('below');
  const [alertSaving, setAlertSaving] = useState(false);

  // Edit State
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editStore, setEditStore] = useState('');
  const [editSelector, setEditSelector] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAlerts();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchData() {
    const token = sessionStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch(`${API_URL}/products/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return; }
        throw new Error('Ürün bulunamadı');
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError('Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAlerts() {
    try {
      const res = await fetch(`${API_URL}/products/${id}/alerts`, { headers: getAuthHeaders() });
      if (res.ok) setAlerts(await res.json());
    } catch (e) { /* ignore */ }
  }

  async function createAlert() {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;
    setAlertSaving(true);
    try {
      const res = await fetch(`${API_URL}/products/${id}/alerts`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_price: price, direction: alertDirection }),
      });
      if (res.ok) {
        setTargetPrice('');
        setShowAlertForm(false);
        fetchAlerts();
      }
    } catch (e) { /* ignore */ }
    finally { setAlertSaving(false); }
  }

  async function deleteAlert(alertId: number) {
    try {
      await fetch(`${API_URL}/products/${id}/alerts/${alertId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      fetchAlerts();
    } catch (e) { /* ignore */ }
  }

  function startEditing() {
    if (!data) return;
    setEditName(data.product.name || '');
    setEditUrl(data.product.url);
    setEditStore(data.product.store);
    setEditSelector(data.product.selector || '');
    setEditSize((data.product as any).size || '');
    setEditCategory(data.product.category || '');
    setEditTags(data.product.tags || '');
    setEditing(true);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          url: editUrl,
          store: editStore,
          selector: editSelector,
          size: editSize,
          category: editCategory || null,
          tags: editTags || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        fetchData();
      }
    } catch (e) { /* ignore */ }
    finally { setEditSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
        <p>Ürün verileri yükleniyor...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-600 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-lg font-medium text-slate-900 mb-2">{error || 'Ürün bulunamadı'}</p>
        <Link href="/products" className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Ürünlere Dön
        </Link>
      </div>
    );
  }

  const { product, history, current_status } = data;

  const chartData = history
    .filter(h => h.price !== null)
    .map(h => ({
      time: new Date(h.checked_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date(h.checked_at).toLocaleDateString('tr-TR'),
      price: h.price,
      inStock: h.in_stock === 1
    }))
    .reverse();

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : null;

  async function handleDelete() {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz? Tüm geçmiş verileri de silinecek.')) return;
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        router.push('/products');
      } else {
        alert('Ürün silinemedi!');
      }
    } catch (e) {
      alert('Ürün silinemedi!');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-white text-slate-500 hover:text-slate-900 rounded-lg shadow-sm border border-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{product.name || 'Ürün Detayı'}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-slate-500">
              <span className="capitalize font-medium text-slate-700">{product.store}</span>
              {product.category && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-indigo-600 font-medium">{product.category}</span>
                </>
              )}
              {product.tags && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex flex-wrap gap-1">
                    {product.tags.split(',').map((tag, i) => (
                      <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-tight">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <span className="text-slate-300">•</span>
              <span className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(product.created_at).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all"
          >
            <Pencil className="w-4 h-4" />
            Düzenle
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 hover:text-rose-700 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Sil
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Pencil className="w-4 h-4 text-indigo-500" /> Ürünü Düzenle</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Adı</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Ürün adı" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
              <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mağaza</label>
              <select value={editStore} onChange={(e) => setEditStore(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-indigo-500 outline-none">
                <option value="trendyol">Trendyol</option>
                <option value="generic">Diğer Site</option>
                <option value="amazon">Amazon TR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">CSS Seçici</label>
              <input value={editSelector} onChange={(e) => setEditSelector(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Opsiyonel" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Kategori</label>
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-indigo-500 outline-none">
                <option value="">Seçilmedi</option>
                <option value="Elektronik">🖥️ Elektronik</option>
                <option value="Giyim">👕 Giyim</option>
                <option value="Ev & Yaşam">🏠 Ev & Yaşam</option>
                <option value="Kozmetik">💄 Kozmetik</option>
                <option value="Spor & Outdoor">⚽ Spor & Outdoor</option>
                <option value="Diğer">📦 Diğer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Etiketler</label>
              <input value={editTags} onChange={(e) => setEditTags(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="indirim, hediye..." />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={saveEdit} disabled={editSaving} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              İptal
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-start gap-4">
            <div className="w-full">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Ürün Bağlantısı</span>
              <a href={product.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 break-all leading-relaxed">
                Ziyaret Et <ExternalLink className="w-4 h-4 shrink-0" />
              </a>
            </div>

            <div className="w-full pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Mevcut Durum</span>
              {current_status ? (
                <div className="flex items-center gap-3">
                  {current_status.value ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Stok Var</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-rose-100 text-rose-800"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Tükendi</span>
                  )}
                  <span className="text-xs text-slate-400 capitalize bg-slate-100 px-2 py-1 rounded-md">{current_status.method}</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-slate-500">Henüz kontrol edilmedi</span>
              )}
            </div>

            <div className="w-full pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Seçici</span>
                <span className="text-sm font-medium text-slate-700">{product.selector || 'Yok'}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Beden</span>
                <span className="text-sm font-medium text-slate-700">{(product as any).size || 'Tümü'}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 shadow-md text-white">
            {product.image_url && (
              <div className="w-full aspect-square rounded-xl overflow-hidden mb-4 border-2 border-white/20">
                <img src={product.image_url} alt={product.name || ''} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-center gap-3 mb-4 opacity-80">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Güncel Fiyat</span>
            </div>
            <div className="text-4xl font-bold tracking-tight mb-4">
              {currentPrice != null ? (currentPrice as number).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '---'}
            </div>
            {/* Price Stats */}
            {(() => {
              const prices = chartData.map(d => d.price).filter((p): p is number => p != null && p > 0);
              if (prices.length < 2) return null;
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
              return (
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/20">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Min</div>
                    <div className="text-sm font-bold">{min.toLocaleString('tr-TR')} ₺</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Ort</div>
                    <div className="text-sm font-bold">{avg.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Max</div>
                    <div className="text-sm font-bold">{max.toLocaleString('tr-TR')} ₺</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Price Alerts Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Fiyat Alarmları</h3>
              </div>
              <button
                onClick={() => setShowAlertForm(!showAlertForm)}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Alarm Ekle
              </button>
            </div>

            {showAlertForm && (
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="Hedef fiyat (₺)"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <select
                    value={alertDirection}
                    onChange={(e) => setAlertDirection(e.target.value as 'below' | 'above')}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="below">Altına düşünce</option>
                    <option value="above">Üstüne çıkınca</option>
                  </select>
                </div>
                <button
                  onClick={createAlert}
                  disabled={alertSaving || !targetPrice}
                  className="w-full py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {alertSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  {alertSaving ? 'Kaydediliyor...' : 'Alarmı Kur'}
                </button>
              </div>
            )}

            <div className="divide-y divide-slate-50">
              {alerts.length === 0 ? (
                <div className="px-6 py-6 text-center text-sm text-slate-400">
                  Henüz fiyat alarmı kurulmamış.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {alert.is_active ? (
                        <Bell className="w-4 h-4 text-amber-500" />
                      ) : (
                        <BellRing className="w-4 h-4 text-emerald-500" />
                      )}
                      <div>
                        <span className="text-sm font-medium text-slate-900">
                          {alert.target_price.toFixed(2)} ₺
                        </span>
                        <span className="text-xs text-slate-400 ml-1.5">
                          {alert.direction === 'below' ? 'altına düşünce' : 'üstüne çıkınca'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.triggered_at ? (
                        <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded">
                          ✓ Tetiklendi
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded animate-pulse">
                          Aktif
                        </span>
                      )}
                      <button onClick={() => deleteAlert(alert.id)} className="p-1 text-slate-400 hover:text-rose-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chart & Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-slate-900">Fiyat Geçmişi</h3>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_URL}/admin/export/history/${id}`, {
                      headers: getAuthHeaders()
                    });
                    if (!res.ok) throw new Error('Hata oluştu');
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `gecmis_${id}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  } catch (e) {
                    alert('Dışa aktarma başarısız oldu.');
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV İndir
              </button>
            </div>
            {chartData.length < 2 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Grafik oluşturmak için en az 2 fiyat verisi bekleniyor.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₺${value}`}
                      domain={['dataMin - 50', 'dataMax + 50']}
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number | undefined) => [`${value} TL`, 'Fiyat']}
                      labelFormatter={(label, payload) => payload.length > 0 ? `${payload[0].payload.date} ${label}` : label}
                    />
                    <Area type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Kontrol Geçmişi (Son 50)</h3>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Hiç log bulunmuyor.</div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fiyat</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kaynak</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(h.checked_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {h.in_stock === 1 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Var</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">Yok</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {h.price != null ? `${h.price} TL` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">
                            {h.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}
