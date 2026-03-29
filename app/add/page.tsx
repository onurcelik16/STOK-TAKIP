'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Link2, Store, Loader2, CheckCircle2, Image as ImageIcon, Tag, ArrowRight, PackageSearch, Sparkles } from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

type DetectedStore = { key: string; label: string; color: string } | null;
type PreviewData = {
  name: string | null;
  imageUrl: string | null;
  price: number | null;
  store: string;
  inStock?: boolean;
};

function detectStore(url: string): DetectedStore {
  if (/trendyol\.com/i.test(url)) return { key: 'trendyol', label: 'Trendyol', color: '#F27A1A' };
  if (/hepsiburada\.com/i.test(url)) return { key: 'hepsiburada', label: 'Hepsiburada', color: '#FF6000' };
  if (/amazon\.com\.tr/i.test(url)) return { key: 'amazon', label: 'Amazon TR', color: '#FF9900' };
  if (/gratis\.com/i.test(url)) return { key: 'gratis', label: 'Gratis', color: '#8B1A6B' };
  return { key: 'generic', label: 'Diğer', color: '#6366F1' };
}

export default function AddProductPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [store, setStore] = useState('');
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Preview state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editName, setEditName] = useState('');
  const [detected, setDetected] = useState<DetectedStore>(null);

  // Auto-detect store from URL
  useEffect(() => {
    const d = detectStore(url);
    setDetected(d);
    if (d) setStore(d.key);
  }, [url]);

  // Fetch preview when URL changes and is valid
  const fetchPreview = useCallback(async (productUrl: string) => {
    if (!productUrl || !productUrl.startsWith('http')) return;
    const d = detectStore(productUrl);
    if (!d) return;

    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`${API_URL}/products/preview?url=${encodeURIComponent(productUrl)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data: PreviewData = await res.json();
        setPreview(data);
        if (data.name) setEditName(data.name);
      }
    } catch (e) {
      console.error('Preview failed', e);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Debounced preview fetch
  useEffect(() => {
    if (!url || url.length < 20) return;
    const timer = setTimeout(() => fetchPreview(url), 800);
    return () => clearTimeout(timer);
  }, [url, fetchPreview]);

  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !store) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          url: url.trim(),
          store,
          selector: undefined,
          size: size || undefined,
          name: editName || preview?.name || undefined,
          image_url: preview?.imageUrl || undefined,
          category: category || null,
          tags: tags || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setSuccess(true);
      setTimeout(() => router.push('/products'), 1500);
    } catch (e: any) {
      setError(e.message || 'Ürün eklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ürün Eklendi!</h2>
        <p className="text-sm text-slate-500 mt-1">Ürünler sayfasına yönlendiriliyorsunuz...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Plus className="w-6 h-6 text-indigo-500" />
          Yeni Ürün Takibi
        </h1>
        <p className="text-sm text-slate-500 mt-1">Ürün URL'sini yapıştırın, sistem otomatik algılasın.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Link2 className="w-4 h-4 inline mr-1 text-slate-400" />
                Ürün URL'si
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.trendyol.com/..."
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
              {detected && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: detected.color + '15', color: detected.color }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  {detected.label} algılandı
                </div>
              )}
            </div>

            {/* Store Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Store className="w-4 h-4 inline mr-1 text-slate-400" />
                Mağaza
              </label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:border-indigo-500 outline-none"
              >
                <option value="">Mağaza Seçin</option>
                <option value="trendyol">🟠 Trendyol</option>
                <option value="amazon">🟢 Amazon TR</option>
                <option value="gratis">💄 Gratis</option>
                <option value="hepsiburada">🟡 Hepsiburada</option>
                <option value="generic">🌐 Diğer Site</option>
              </select>
            </div>

            {/* Editable Name */}
            {(preview?.name || editName) && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Tag className="w-4 h-4 inline mr-1 text-slate-400" />
                  Ürün Adı
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  placeholder="Ürün adını düzenleyebilirsiniz"
                />
              </div>
            )}

            {/* Category & Tags */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white shadow-sm transition-all"
                >
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
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none shadow-sm transition-all"
                  placeholder="ör: indirim, hediye"
                />
              </div>
            </div>

            {/* Optional fields */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Beden (opsiyonel)</label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all shadow-sm"
                placeholder="M, L, XL..."
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !url || !store}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Ürünü Takibe Al
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preview Card */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <PackageSearch className="w-4 h-4 text-indigo-500" />
                Ürün Önizleme
              </h3>
            </div>

            {previewLoading ? (
              <div className="p-8 flex flex-col items-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">Ürün bilgileri yükleniyor...</span>
              </div>
            ) : preview ? (
              <div className="p-5 space-y-4">
                {preview.imageUrl ? (
                  <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                    <img
                      src={preview.imageUrl}
                      alt={preview.name || ''}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                    {editName || preview.name || 'Ürün adı bulunamadı'}
                  </h4>
                  <div className="flex items-center gap-2 mt-2">
                    {detected && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: detected.color + '15', color: detected.color }}>
                        {detected.label}
                      </span>
                    )}
                    {preview.inStock !== undefined && (
                      preview.inStock
                        ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Stokta</span>
                        : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Tükendi</span>
                    )}
                  </div>
                </div>

                {preview.price && (
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl p-4 text-center">
                    <div className="text-xs text-white/70 mb-1">Güncel Fiyat</div>
                    <div className="text-2xl font-bold text-white">
                      {preview.price.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center text-slate-300">
                <PackageSearch className="w-10 h-10 mb-3" />
                <p className="text-xs text-slate-400 text-center">
                  Bir ürün URL'si yapıştırın,<br />bilgiler otomatik yüklenecek
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
