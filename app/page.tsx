'use client';

import Link from 'next/link';
import { Package, TrendingDown, Bell, Shield, ArrowRight, BarChart3, Zap, Globe2, CheckCircle2, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const duration = 2000;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(current));
            }
        }, duration / steps);
        return () => clearInterval(timer);
    }, [target]);
    return <>{count.toLocaleString('tr-TR')}{suffix}</>;
}

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
            {/* Navbar */}
            <nav className="relative z-10 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Stock<span className="text-indigo-400">Tracker</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2">
                            Giriş Yap
                        </Link>
                        <Link href="/login" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                            Hemen Başla
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-20 pb-32 px-6">
                {/* Background gradient blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl"></div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8 text-sm backdrop-blur-sm">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-slate-300">Türkiye'nin en gelişmiş stok takip sistemi</span>
                    </div>

                    <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
                        Fiyatları Takip Et,<br />
                        <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                            Doğru Anda Yakala
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Trendyol, Amazon TR ve diğer e-ticaret sitelerindeki ürünlerin fiyat ve stok durumlarını
                        otomatik takip edin. Fiyat düştüğünde veya stok geldiğinde anında bildirim alın.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/login"
                            className="group inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
                        >
                            Ücretsiz Başla
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="#features"
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-white px-8 py-4 rounded-2xl text-base font-medium border border-white/10 hover:border-white/20 transition-all bg-white/5 backdrop-blur-sm"
                        >
                            Özellikleri Keşfet
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="border-y border-white/5 bg-white/[0.02] backdrop-blur-sm">
                <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { value: 3, suffix: '+', label: 'Mağaza Desteği' },
                        { value: 24, suffix: '/7', label: 'Otomatik Takip' },
                        { value: 100, suffix: '%', label: 'Ücretsiz' },
                        { value: 10, suffix: 'sn', label: 'Kurulum Süresi' },
                    ].map((stat, i) => (
                        <div key={i}>
                            <div className="text-3xl sm:text-4xl font-bold text-white">
                                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                            </div>
                            <div className="text-sm text-slate-500 mt-1 font-medium">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                            Her Şey Tek Panelde
                        </h2>
                        <p className="text-slate-400 text-lg max-w-xl mx-auto">
                            Fiyat takibi, stok kontrolü ve bildirimleri kolayca yönetin.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: TrendingDown,
                                title: 'Fiyat Takibi',
                                desc: 'Ürün fiyatlarını otomatik takip edin. Fiyat düştüğünde anında haberdar olun ve en uygun fiyattan alışveriş yapın.',
                                color: 'from-emerald-500 to-teal-500',
                                bg: 'bg-emerald-500/10',
                            },
                            {
                                icon: Bell,
                                title: 'Anlık Bildirimler',
                                desc: 'Telegram üzerinden stok ve fiyat değişikliklerinde anında bildirim alın. Bir fırsatı asla kaçırmayın.',
                                color: 'from-amber-500 to-orange-500',
                                bg: 'bg-amber-500/10',
                            },
                            {
                                icon: Globe2,
                                title: 'Multi-Mağaza',
                                desc: 'Trendyol, Amazon TR ve diğer mağazalar. Tek panelden tüm mağazaları takip edin.',
                                color: 'from-blue-500 to-cyan-500',
                                bg: 'bg-blue-500/10',
                            },
                            {
                                icon: BarChart3,
                                title: 'Fiyat Geçmişi',
                                desc: 'Fiyat grafikleri ve istatistiklerle trendleri analiz edin. Min, max ve ortalama fiyatları görün.',
                                color: 'from-violet-500 to-purple-500',
                                bg: 'bg-violet-500/10',
                            },
                            {
                                icon: Shield,
                                title: 'Güvenli & Hızlı',
                                desc: 'Güçlü şifreleme, JWT tabanlı oturum yönetimi. Verileriniz güvende.',
                                color: 'from-rose-500 to-pink-500',
                                bg: 'bg-rose-500/10',
                            },
                            {
                                icon: Zap,
                                title: 'Kolay Kurulum',
                                desc: 'URL yapıştır, mağaza otomatik algılansın. 10 saniyede ürün takibine başla.',
                                color: 'from-indigo-500 to-blue-500',
                                bg: 'bg-indigo-500/10',
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300"
                            >
                                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                                    <feature.icon className={`w-6 h-6 bg-gradient-to-r ${feature.color} bg-clip-text`} style={{ color: feature.color.includes('emerald') ? '#10b981' : feature.color.includes('amber') ? '#f59e0b' : feature.color.includes('blue') ? '#3b82f6' : feature.color.includes('violet') ? '#8b5cf6' : feature.color.includes('rose') ? '#f43f5e' : '#6366f1' }} />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Supported Stores */}
            <section className="py-20 px-6 border-t border-white/5">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Desteklenen Mağazalar</h2>
                    <p className="text-slate-400 mb-12">En popüler e-ticaret sitelerini tek panelden takip edin</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                            { name: 'Trendyol', color: '#F27A1A', letter: 'T', desc: 'Türkiye\'nin en büyük e-ticaret sitesi' },
                            { name: 'Diğer Siteler', color: '#6366F1', letter: 'D', desc: 'Herhangi bir e-ticaret sitesi' },
                            { name: 'Amazon TR', color: '#FF9900', letter: 'A', desc: 'Global e-ticaret devi' },
                        ].map((store, i) => (
                            <div
                                key={i}
                                className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-center hover:border-white/10 transition-all group"
                            >
                                <div
                                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white shadow-lg"
                                    style={{ backgroundColor: store.color + '20', boxShadow: `0 8px 32px ${store.color}15` }}
                                >
                                    <span style={{ color: store.color }}>{store.letter}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-1">{store.name}</h3>
                                <p className="text-sm text-slate-500">{store.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-6 bg-white/[0.02]">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-12">Nasıl Çalışır?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { step: '1', title: 'Kayıt Ol', desc: 'E-posta ve şifre ile hızlıca üye olun.' },
                            { step: '2', title: 'Ürün Ekle', desc: 'Takip etmek istediğiniz ürünün URL\'sini yapıştırın.' },
                            { step: '3', title: 'Bildirimi Al', desc: 'Fiyat düştüğünde veya stok geldiğinde Telegram\'dan bilgi alın.' },
                        ].map((item, i) => (
                            <div key={i} className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-bold text-indigo-400">{item.step}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                                <p className="text-sm text-slate-400">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/20 border border-indigo-500/20 rounded-3xl p-12 backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5"></div>
                        <div className="relative z-10">
                            <Star className="w-10 h-10 text-amber-400 mx-auto mb-6" />
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                                Fırsatları Kaçırmayın
                            </h2>
                            <p className="text-slate-400 text-lg mb-8 max-w-lg mx-auto">
                                Hemen ücretsiz hesap oluşturun ve ürün fiyatlarını takip etmeye başlayın.
                            </p>
                            <Link
                                href="/login"
                                className="group inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
                            >
                                Ücretsiz Kayıt Ol
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-500" />
                        <span className="font-semibold text-white">Stock<span className="text-indigo-400">Tracker</span></span>
                    </div>
                    <p className="text-sm text-slate-500">
                        © 2026 StockTracker. Tüm hakları saklıdır.
                    </p>
                </div>
            </footer>
        </div>
    );
}
