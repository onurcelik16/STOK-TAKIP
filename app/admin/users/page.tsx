'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, UserX, ChevronDown, Loader2, AlertTriangle, Package, Calendar, ExternalLink } from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

type User = {
    id: number;
    email: string;
    name: string | null;
    role: string;
    created_at: string;
    product_count: number;
};

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    useEffect(() => {
        const stored = sessionStorage.getItem('user');
        if (stored) setCurrentUser(JSON.parse(stored));
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const res = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() });
            if (res.status === 403) {
                setError('Bu sayfaya erişim yetkiniz yok. Admin hesabıyla giriş yapmalısınız.');
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            setUsers(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function changeRole(userId: number, newRole: string) {
        setActionLoading(userId);
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Rol değiştirilemedi');
                return;
            }
            await fetchUsers();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setActionLoading(null);
        }
    }

    async function deleteUser(userId: number) {
        setActionLoading(userId);
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Kullanıcı silinemedi');
                return;
            }
            setConfirmDelete(null);
            await fetchUsers();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto mt-12">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                    <p className="text-rose-700 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-500" />
                    Kullanıcı Yönetimi
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Toplam <span className="font-semibold text-slate-700">{users.length}</span> kayıtlı kullanıcı
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Toplam</div>
                    <div className="text-2xl font-bold text-slate-900">{users.length}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Admin</div>
                    <div className="text-2xl font-bold text-indigo-600">{users.filter(u => u.role === 'admin').length}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kullanıcı</div>
                    <div className="text-2xl font-bold text-slate-600">{users.filter(u => u.role === 'user').length}</div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Kullanıcı</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Rol</th>
                                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Ürün</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Kayıt</th>
                                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map((user) => {
                                const isMe = user.id === currentUser?.id;
                                const initials = (user.name || user.email.split('@')[0]).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

                                return (
                                    <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${isMe ? 'bg-indigo-50/30' : ''}`}>
                                        {/* User Info */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${user.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-400'}`}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm text-slate-900 flex items-center gap-1.5">
                                                        {user.name || user.email.split('@')[0]}
                                                        {isMe && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">Sen</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-400">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role */}
                                        <td className="px-4 py-4">
                                            {user.role === 'admin' ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                                                    <Shield className="w-3 h-3" /> Admin
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                                                    👤 Kullanıcı
                                                </span>
                                            )}
                                        </td>

                                        {/* Product Count */}
                                        <td className="px-4 py-4 text-center">
                                            <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                                                <Package className="w-3.5 h-3.5 text-slate-400" />
                                                {user.product_count}
                                                {user.role === 'user' && <span className="text-slate-400 text-xs">/10</span>}
                                            </div>
                                        </td>

                                        {/* Created */}
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(user.created_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-right">
                                            {!isMe ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* View Products */}
                                                    <a
                                                        href={`/admin/users/${user.id}/products`}
                                                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                                                        title="Ürünleri Görüntüle"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        Ürünler
                                                    </a>

                                                    {/* Toggle Role */}
                                                    <button
                                                        onClick={() => changeRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
                                                        disabled={actionLoading === user.id}
                                                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                                                    >
                                                        {actionLoading === user.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            user.role === 'admin' ? 'User yap' : 'Admin yap'
                                                        )}
                                                    </button>

                                                    {/* Delete */}
                                                    {confirmDelete === user.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => deleteUser(user.id)}
                                                                disabled={actionLoading === user.id}
                                                                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50"
                                                            >
                                                                {actionLoading === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Evet'}
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(null)}
                                                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                                                            >
                                                                İptal
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDelete(user.id)}
                                                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition"
                                                        >
                                                            <UserX className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
