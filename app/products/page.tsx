'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Plus, Search, Loader2, Download, Package, PackageX,
    Trash2, Tag, ChevronDown, CheckSquare, Square, Clock,
    AlertCircle, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL, getAuthHeaders, getProxyImageUrl } from '@/lib/api';

type Product = {
    id: number;
    url: string;
    store: string;
    selector: string | null;
    name: string | null;
    image_url: string | null;
    category: string | null;
    tags: string | null;
    created_at: string;
    last_in_stock: number | null;
    last_price: number | null;
    last_checked_at: string | null;
    last_source: string | null;
    owner_email?: string;
    lastStatus?: { inStock: boolean; price?: number | null; source: string; checked_at: string };
};

export default function ProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAllProducts, setShowAllProducts] = useState(false);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [showBulkCategoryMenu, setShowBulkCategoryMenu] = useState(false);

    useEffect(() => {
        const userStr = sessionStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setIsAdmin(user.role === 'admin');
            } catch (e) { }
        }
        fetchProducts();
        const interval = setInterval(fetchProducts, 30000);
        return () => clearInterval(interval);
    }, [showAllProducts]);

    async function fetchProducts() {
        const token = sessionStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }

        try {
            const url = showAllProducts ? `${API_URL}/products?all=true` : `${API_URL}/products`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            const enhanced = data.map((p: any) => ({
                ...p,
                lastStatus: p.last_checked_at ? {
                    inStock: p.last_in_stock === 1,
                    price: p.last_price,
                    source: p.last_source || 'http',
                    checked_at: p.last_checked_at,
                } : undefined,
            }));
            setProducts(enhanced);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filtered = products.filter(p => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = p.url.toLowerCase().includes(q) ||
            p.store.toLowerCase().includes(q) ||
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.tags && p.tags.toLowerCase().includes(q));

        const matchesCategory = selectedCategory === 'Tümü' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ['Tümü', 'Elektronik', 'Giyim', 'Ev & Yaşam', 'Kozmetik', 'Spor & Outdoor', 'Diğer'];

    const toggleSelect = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectAll = () => {
        const visibleIds = filtered.map(p => p.id);
        const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));

        const next = new Set(selectedIds);
        if (allVisibleSelected) {
            visibleIds.forEach(id => next.delete(id));
        } else {
            visibleIds.forEach(id => next.add(id));
        }
        setSelectedIds(next);
    };

    async function handleBulkDelete() {
        if (!confirm(`${selectedIds.size} ürünü silmek istediğinize emin misiniz?`)) return;
        setBulkActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/products/bulk-delete`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });
            if (res.ok) {
                setSelectedIds(new Set());
                fetchProducts();
            }
        } catch (e) { alert('Hata oluştu'); }
        finally { setBulkActionLoading(false); }
    }

    async function handleBulkCategory(category: string) {
        setBulkActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/products/bulk-category`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids: Array.from(selectedIds), category })
            });
            if (res.ok) {
                setSelectedIds(new Set());
                setShowBulkCategoryMenu(false);
                fetchProducts();
            }
        } catch (e) { alert('Hata oluştu'); }
        finally { setBulkActionLoading(false); }
    }

    function getProductLabel(p: Product): string {
        if (p.name) return p.name;
        try {
            const path = new URL(p.url).pathname;
            return path.split('/').filter(s => s.length > 3).slice(-1)[0]?.replace(/-/g, ' ').replace(/p \d+$/, '').trim() || p.url;
        } catch { return p.url; }
    }

    return (
        <div className="space-y-6 lg:space-y-8 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {showAllProducts ? 'Sistemdeki Tüm Ürünler' : 'Ürünlerim'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {showAllProducts ? 'Tüm kullanıcıların takip ettiği ürünler' : `Takip ettiğiniz ürünler (${products.length})`}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {isAdmin && (
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm mr-2">
                            <button
                                onClick={() => setShowAllProducts(false)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${!showAllProducts ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Benimkiler
                            </button>
                            <button
                                onClick={() => setShowAllProducts(true)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${showAllProducts ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Hepsi
                            </button>
                        </div>
                    )}
                    <div className="flex-1 relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Ürün, mağaza veya etiket ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                try {
                                    const userStr = sessionStorage.getItem('user');
                                    const user = userStr ? JSON.parse(userStr) : null;
                                    const userId = user?.role !== 'admin' ? user?.id : null;
                                    const url = userId ? `${API_URL}/admin/export/products?userId=${userId}` : `${API_URL}/admin/export/products`;

                                    const res = await fetch(url, { headers: getAuthHeaders() });
                                    if (!res.ok) throw new Error('Hata');
                                    const blob = await res.blob();
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = blobUrl;
                                    a.download = `urunler_${new Date().toISOString().slice(0, 10)}.csv`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                } catch (e) { alert('Dışa aktarma hatası'); }
                            }}
                            className="inline-flex items-center gap-2 bg-slate-50 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 hover:bg-white hover:border-indigo-200 transition font-medium text-sm shadow-sm"
                        >
                            <Download className="w-4 h-4" /> CSV
                        </button>
                        <Link
                            href="/add"
                            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition font-medium text-sm shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Ekle
                        </Link>
                    </div>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                                "px-4 py-2 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg border-b-2 -mb-[1px]",
                                selectedCategory === cat
                                    ? "text-indigo-600 border-indigo-600 bg-indigo-50/30"
                                    : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                {filtered.length > 0 && (
                    <button
                        onClick={selectAll}
                        className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-slate-50 transition-all"
                    >
                        {filtered.every(p => selectedIds.has(p.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        Tümünü Seç
                    </button>
                )}
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2 border-r border-slate-700 pr-6 mr-2">
                        <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                        <span className="text-sm font-medium">Ürün Seçildi</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowBulkCategoryMenu(!showBulkCategoryMenu)}
                                className="flex items-center gap-2 text-sm font-semibold hover:text-indigo-400 transition"
                            >
                                <Tag className="w-4 h-4" /> Kategori Değiştir
                            </button>
                            {showBulkCategoryMenu && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 text-slate-900 animate-in fade-in zoom-in-95 duration-200">
                                    {categories.filter(c => c !== 'Tümü').map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => handleBulkCategory(cat)}
                                            className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 rounded-lg transition"
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkActionLoading}
                            className="flex items-center gap-2 text-sm font-semibold text-rose-400 hover:text-rose-300 transition disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" /> Sil
                        </button>
                    </div>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="ml-4 text-slate-500 hover:text-white transition"
                    >
                        İptal
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                    <p className="text-sm font-medium tracking-tight">Ürünler Yükleniyor...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center flex flex-col items-center">
                    <PackageX className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">Ürün Bulunamadı</h3>
                    <p className="text-sm text-slate-500 mt-1 mb-6 max-w-sm">
                        {searchQuery ? 'Arama kriterlerinize uygun ürün bulunamadı.' : 'Henüz takip edilen ürününüz bulunmuyor.'}
                    </p>
                    <Link href="/add" className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
                        <Plus className="w-4 h-4" /> İlk Ürününü Ekle
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((product) => {
                        const status = product.lastStatus;
                        const label = getProductLabel(product);
                        const isSelected = selectedIds.has(product.id);

                        return (
                            <div key={product.id} className="relative">
                                <Link
                                    href={`/products/${product.id}`}
                                    className={cn(
                                        "group block bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full",
                                        isSelected
                                            ? "border-indigo-500 ring-2 ring-indigo-500/10 shadow-lg"
                                            : "border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
                                    )}
                                >
                                    {/* Selection Checkbox */}
                                    <button
                                        onClick={(e) => toggleSelect(product.id, e)}
                                        className={cn(
                                            "absolute top-3 right-3 z-10 p-1.5 rounded-lg transition-all",
                                            isSelected
                                                ? "bg-indigo-500 text-white"
                                                : "bg-white/80 backdrop-blur-sm text-slate-300 border border-slate-200 opacity-0 group-hover:opacity-100"
                                        )}
                                    >
                                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    </button>

                                    {/* Product Image + Header */}
                                    <div className="flex gap-4 p-4 pb-3">
                                        {product.image_url ? (
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                                                <img
                                                    src={getProxyImageUrl(product.image_url)}
                                                    alt={product.name || 'Ürün'}
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 shrink-0 flex items-center justify-center">
                                                <Package className="w-6 h-6 text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tight">{product.store}</span>
                                                {product.category && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase tracking-tight">{product.category}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                                    {label}
                                                </h3>
                                                {showAllProducts && product.owner_email && (
                                                    <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                        {product.owner_email.split('@')[0]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status & Stats */}
                                    <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 mt-auto">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex flex-wrap gap-1">
                                                {product.tags ? (
                                                    product.tags.split(',').slice(0, 2).map((tag, i) => (
                                                        <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                                                            #{tag.trim()}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Etiket yok</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Son Fiyat</p>
                                                <p className="text-sm font-bold text-slate-900">
                                                    {status?.price ? `${status.price.toLocaleString('tr-TR')} ₺` : '---'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                {status?.inStock ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        STOKTA
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                                        TÜKENDİ
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                                <Clock className="w-3 h-3" />
                                                {status?.checked_at ? new Date(status.checked_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
