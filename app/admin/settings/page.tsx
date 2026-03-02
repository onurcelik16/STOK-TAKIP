'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Settings, Server, Database, Users, Package, Activity,
    Clock, Save, Loader2, AlertTriangle, HardDrive, Cpu, Timer, Bell, RefreshCw
} from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}g ${h}s ${m}dk`;
    if (h > 0) return `${h}s ${m}dk`;
    return `${m}dk`;
}

const CRON_OPTIONS = [
    { label: 'Her 5 dakika', value: '*/5 * * * *' },
    { label: 'Her 10 dakika', value: '*/10 * * * *' },
    { label: 'Her 15 dakika', value: '*/15 * * * *' },
    { label: 'Her 30 dakika', value: '*/30 * * * *' },
    { label: 'Her 1 saat', value: '0 * * * *' },
    { label: 'Her 3 saat', value: '0 */3 * * *' },
    { label: 'Her 6 saat', value: '0 */6 * * *' },
];

const LIMIT_OPTIONS = [5, 10, 25, 50, 100];

type SystemInfo = {
    dbSize: number;
    totalUsers: number;
    totalProducts: number;
    totalChecks: number;
    totalAlerts: number;
    activeAlerts: number;
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
};

type SettingsData = {
    cron_interval: string;
    product_limit: string;
    notification_email: string;
};

export default function AdminSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [settings, setSettings] = useState<SettingsData>({
        cron_interval: '*/10 * * * *',
        product_limit: '10',
        notification_email: '',
    });
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            const res = await fetch(`${API_URL}/admin/system-settings`, { headers: getAuthHeaders() });
            if (res.status === 403) {
                setError('Bu sayfaya erişim yetkiniz yok.');
                setLoading(false);
                return;
            }
            if (!res.ok) throw new Error('Ayarlar yüklenemedi');
            const data = await res.json();
            setSettings(data.settings);
            setSystemInfo(data.systemInfo);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function saveSettings() {
        setSaving(true);
        setSuccess(false);
        try {
            const res = await fetch(`${API_URL}/admin/system-settings`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error('Ayarlar kaydedilemedi');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
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

    const infoCards = systemInfo ? [
        { label: 'Toplam Kullanıcı', value: systemInfo.totalUsers, icon: Users, color: 'indigo' },
        { label: 'Toplam Ürün', value: systemInfo.totalProducts, icon: Package, color: 'emerald' },
        { label: 'Toplam Kontrol', value: systemInfo.totalChecks.toLocaleString('tr-TR'), icon: Activity, color: 'violet' },
        { label: 'Aktif Alarm', value: `${systemInfo.activeAlerts}/${systemInfo.totalAlerts}`, icon: Bell, color: 'amber' },
        { label: 'DB Boyutu', value: formatBytes(systemInfo.dbSize), icon: HardDrive, color: 'sky' },
        { label: 'Uptime', value: formatUptime(systemInfo.uptimeSeconds), icon: Timer, color: 'rose' },
    ] : [];

    const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
        indigo: { bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', text: 'text-indigo-600' },
        emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', text: 'text-emerald-600' },
        violet: { bg: 'bg-violet-50', iconBg: 'bg-violet-100', text: 'text-violet-600' },
        amber: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', text: 'text-amber-600' },
        sky: { bg: 'bg-sky-50', iconBg: 'bg-sky-100', text: 'text-sky-600' },
        rose: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', text: 'text-rose-600' },
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Settings className="w-6 h-6 text-indigo-500" />
                        Sistem Ayarları
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Uygulama yapılandırması ve sistem durumu
                    </p>
                </div>
                <button onClick={fetchSettings} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* System Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {infoCards.map((card) => {
                    const colors = colorMap[card.color];
                    return (
                        <div key={card.label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                            <div className={`p-2 rounded-lg ${colors.iconBg} w-fit mb-2`}>
                                <card.icon className={`w-4 h-4 ${colors.text}`} />
                            </div>
                            <div className="text-lg font-bold text-slate-900">{card.value}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{card.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* System Runtime Info */}
            {systemInfo && (
                <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Cpu className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-700">Sistem Bilgileri</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-slate-400">Node.js:</span>
                            <span className="ml-1 font-medium text-slate-700">{systemInfo.nodeVersion}</span>
                        </div>
                        <div>
                            <span className="text-slate-400">Platform:</span>
                            <span className="ml-1 font-medium text-slate-700">{systemInfo.platform}</span>
                        </div>
                        <div>
                            <span className="text-slate-400">DB:</span>
                            <span className="ml-1 font-medium text-slate-700">SQLite ({formatBytes(systemInfo.dbSize)})</span>
                        </div>
                        <div>
                            <span className="text-slate-400">Uptime:</span>
                            <span className="ml-1 font-medium text-slate-700">{formatUptime(systemInfo.uptimeSeconds)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <Server className="w-5 h-5 text-indigo-500" />
                        Yapılandırma
                    </h3>
                </div>

                <div className="p-6 space-y-6">
                    {/* Cron Interval */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <Clock className="inline w-4 h-4 mr-1 text-slate-400" />
                            Stok Kontrol Aralığı
                        </label>
                        <p className="text-xs text-slate-400 mb-2">
                            Ürünlerin ne sıklıkla kontrol edileceğini belirler. Daha sık kontrol daha fazla kaynak kullanır.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {CRON_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSettings({ ...settings, cron_interval: opt.value })}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${settings.cron_interval === opt.value
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Limit */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <Package className="inline w-4 h-4 mr-1 text-slate-400" />
                            Kullanıcı Ürün Limiti
                        </label>
                        <p className="text-xs text-slate-400 mb-2">
                            Normal kullanıcıların takip edebileceği maksimum ürün sayısı. Admin kullanıcılar sınırsızdır.
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {LIMIT_OPTIONS.map((limit) => (
                                <button
                                    key={limit}
                                    onClick={() => setSettings({ ...settings, product_limit: String(limit) })}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all min-w-[60px] ${settings.product_limit === String(limit)
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                >
                                    {limit}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notification Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <Bell className="inline w-4 h-4 mr-1 text-slate-400" />
                            Bildirim E-postası
                        </label>
                        <p className="text-xs text-slate-400 mb-2">
                            Sistem bildirimlerinin gönderileceği e-posta adresi (isteğe bağlı).
                        </p>
                        <input
                            type="email"
                            value={settings.notification_email}
                            onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                            placeholder="admin@example.com"
                            className="w-full sm:w-96 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div>
                        {success && (
                            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                                ✓ Ayarlar kaydedildi
                            </span>
                        )}
                    </div>
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}
