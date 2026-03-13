'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, User, Bell, Save, CheckCircle, AlertCircle, Loader2, MessageCircle, ExternalLink } from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [telegramVerifyCode, setTelegramVerifyCode] = useState<string | null>(null);
    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {
        const token = sessionStorage.getItem('token');
        if (!token) { router.push('/login'); return; }
        try {
            const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setName(data.name || '');
            setEmail(data.email || '');
            setTelegramChatId(data.telegram_chat_id || '');
            setTelegramVerifyCode(data.telegram_verify_code || null);
            setEmailNotifications(data.email_notifications !== 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleTelegramConnect() {
        setGeneratingLink(true);
        try {
            const res = await fetch(`${API_URL}/auth/telegram/connect`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Bağlantı kodu oluşturulamadı');
            const data = await res.json();
            setTelegramVerifyCode(data.code);
            setTelegramLink(data.link);
            window.open(data.link, '_blank');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGeneratingLink(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, telegram_chat_id: telegramChatId, email_notifications: emailNotifications }),
            });
            if (!res.ok) throw new Error('Failed to update');
            const user = await res.json();
            sessionStorage.setItem('user', JSON.stringify(user));
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: any) {
            setError(e.message || 'Kayıt başarısız');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ayarlar</h1>
                <p className="text-sm text-slate-500 mt-1">Profil bilgilerini ve bildirim tercihlerini yönet.</p>
            </div>

            {/* Profile Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-base font-semibold text-slate-900">Profil Bilgileri</h2>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">E-posta</label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-400 mt-1">E-posta adresi değiştirilemez.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Ad Soyad</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Adınızı girin"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        />
                    </div>
                </div>
            </div>

            {/* Telegram Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-500" />
                    <h2 className="text-base font-semibold text-slate-900">Telegram Bildirimleri</h2>
                </div>
                <div className="p-6">
                    {telegramChatId ? (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                                    <CheckCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-emerald-900">Telegram Bağlı</h3>
                                    <p className="text-xs text-emerald-700">Chat ID: {telegramChatId}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setTelegramChatId('')}
                                className="text-xs font-medium text-slate-500 hover:text-rose-600 transition"
                            >
                                Bağlantıyı Kes
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                <h3 className="text-sm font-medium text-slate-900 mb-2">Kolay Entegrasyon</h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Telegram üzerinden anlık stok ve fiyat bildirimleri almak için aşağıdaki butona tıklayarak botumuzu başlatmanız yeterlidir.
                                </p>
                                <button
                                    onClick={handleTelegramConnect}
                                    disabled={generatingLink}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {generatingLink ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                                    Telegram'a Bağlan
                                </button>
                            </div>

                            {telegramVerifyCode && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-medium text-amber-900 mb-2 font-semibold">Doğrulama Bekleniyor</h3>
                                    <p className="text-sm text-amber-800 mb-3">
                                        Eğer bot otomatik açılmadıysa Telegram'da <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">/start {telegramVerifyCode}</span> komutunu gönderin.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => window.open(telegramLink || '#', '_blank')}
                                            className="text-xs font-semibold text-amber-900 underline flex items-center gap-1"
                                        >
                                            Tekrar Dene <ExternalLink className="w-3 h-3" />
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            onClick={fetchProfile}
                                            className="text-xs font-semibold text-indigo-600 hover:underline"
                                        >
                                            Bağlantıyı Kontrol Et
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base font-semibold text-slate-900">Bildirim Tercihleri</h2>
                </div>
                <div className="p-6 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={emailNotifications}
                            onChange={(e) => setEmailNotifications(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                            <span className="text-sm font-medium text-slate-900">E-posta ile bildirim al</span>
                            <p className="text-xs text-slate-400">Stok değişimi ve fiyat alarmlarında e-posta gönderilsin</p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>

                {success && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-pulse">
                        <CheckCircle className="w-4 h-4" /> Başarıyla kaydedildi!
                    </span>
                )}
                {error && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-rose-600 font-medium">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </span>
                )}
            </div>
        </div>
    );
}
