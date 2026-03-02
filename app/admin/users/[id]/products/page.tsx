'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, ExternalLink, Package, PackageX, Clock, Loader2, Download, User } from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

type Product = {
    id: number;
    url: string;
    store: string;
    name: string | null;
    image_url: string | null;
    size: string | null;
    category: string | null;
    tags: string | null;
    last_stock: number | null;
    last_price: number | null;
    last_check: string | null;
    check_count: number;
};

type UserData = {
    id: number;
    email: string;
    name: string | null;
    role: string;
};

export default function UserProductsPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id;

    const [user, setUser] = useState<UserData | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userId) fetchUserProducts();
    }, [userId]);

    async function fetchUserProducts() {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/products`, {
                headers: getAuthHeaders()
            });
            if (res.status === 403) {
                setError('Bu sayfaya erişim yetkiniz yok.');
                return;
            }
            if (!res.ok) throw new Error('Veriler yüklenemedi');
            const data = await res.json();
            setUser(data.user);
            setProducts(data.products);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const filtered = products.filter(p =>
        (p.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.store.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.category?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.tags?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-500 animate-pulse">Kullanıcı ürünleri yükleniyor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto mt-12 bg-rose-50 border border-rose-100 p-8 rounded-2xl text-center">
                <PackageX className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-rose-900">Hata Oluştu</h3>
                <p className="text-rose-600 mt-2">{error}</p>
                <Link href="/admin/users" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-rose-700 hover:text-rose-800 underline">
                    <ArrowLeft className="w-4 h-4" /> Kullanıcılara Geri Dön
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/users"
                            className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <User className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-medium text-slate-500">Kullanıcı Ürünleri</span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {user?.name || user?.email.split('@')[0]}
                            </h1>
                            <p className="text-sm text-slate-400">{user?.email}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Ürünlerde ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm"
                            />
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const res = await fetch(`${API_URL}/admin/export/products?userId=${userId}`, {
                                        headers: getAuthHeaders()
                                    });
                                    if (!res.ok) throw new Error('Hata');
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `user_${userId}_products.csv`;
                                    a.click();
                                } catch (e) { alert('Dışa aktarma hatası'); }
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-all text-sm font-semibold shadow-sm"
                        >
                            <Download className="w-4 h-4" /> CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Toplam Ürün</p>
                    <p className="text-2xl font-bold text-slate-900">{products.length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Stokta Olanlar</p>
                    <p className="text-2xl font-bold text-emerald-600">{products.filter(p => p.last_stock === 1).length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tükenenler</p>
                    <p className="text-2xl font-bold text-rose-600">{products.filter(p => p.last_stock === 0).length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mağaza Sayısı</p>
                    <p className="text-2xl font-bold text-indigo-600">{new Set(products.map(p => p.store)).size}</p>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ürün Bilgisi</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Kategori</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Mağaza</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Durum</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Son Fiyat</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Son Kontrol</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        Ürün bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">
                                                        {product.name || 'İsimsiz Ürün'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{product.url}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit">
                                                    {product.category || 'Belirtilmedi'}
                                                </span>
                                                {product.tags && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {product.tags.split(',').slice(0, 2).map((t, idx) => (
                                                            <span key={idx} className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100/50">
                                                                #{t.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                                                {product.store}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {product.last_stock === 1 ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-inset ring-emerald-600/10">
                                                    Stokta
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full ring-1 ring-inset ring-rose-600/10">
                                                    Tükendi
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-900">
                                                {product.last_price ? `${product.last_price.toFixed(2)} ₺` : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <Clock className="w-3.5 h-3.5" />
                                                {product.last_check ? new Date(product.last_check).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Hiç'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/products/${product.id}`}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Detay <ExternalLink className="w-3.5 h-3.5" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
