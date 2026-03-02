'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { API_URL } from '@/lib/api';

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Zayıf', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Orta', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'İyi', color: '#3b82f6' };
  return { score, label: 'Güçlü', color: '#10b981' };
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password === passwordConfirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isRegister) {
      if (!name.trim()) { setError('Ad soyad zorunludur'); setLoading(false); return; }
      if (password.length < 8) { setError('Şifre en az 8 karakter olmalıdır'); setLoading(false); return; }
      if (!passwordsMatch) { setError('Şifreler eşleşmiyor'); setLoading(false); return; }
      if (!acceptedTerms) { setError('Kullanım koşullarını kabul etmelisiniz'); setLoading(false); return; }
    }

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body: any = { email, password };
      if (isRegister) body.name = name;

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        const msg = typeof err.error === 'string' ? err.error : err.error?.message || (isRegister ? 'Kayıt başarısız' : 'Geçersiz e-posta veya şifre');
        throw new Error(msg);
      }

      const data = await res.json();
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));

      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || (isRegister ? 'Kayıt başarısız' : 'Giriş başarısız'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Stock<span className="text-indigo-400">Tracker</span></span>
          </div>
        </Link>
        <h2 className="text-center text-2xl font-bold text-white tracking-tight">
          {isRegister ? 'Yeni Hesap Oluştur' : 'Hesabınıza Giriş Yapın'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          {isRegister ? 'Ücretsiz hesap oluşturun ve takibe başlayın.' : 'Ürün fiyatlarını anlık takip edin.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/50 backdrop-blur-xl py-8 px-6 shadow-2xl sm:rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Ad Soyad <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  placeholder="Adınız Soyadınız"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                E-posta {isRegister && <span className="text-rose-400">*</span>}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                placeholder="ornek@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Şifre {isRegister && <span className="text-rose-400">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isRegister ? 8 : 1}
                  className="block w-full px-4 py-3 pr-12 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  placeholder={isRegister ? 'En az 8 karakter' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {isRegister && password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ backgroundColor: level <= strength.score ? strength.color : '#334155' }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</span>
                    <div className="flex gap-2 text-[10px] text-slate-500">
                      <span className={/[A-Z]/.test(password) ? 'text-emerald-400' : ''}>ABC</span>
                      <span className={/[0-9]/.test(password) ? 'text-emerald-400' : ''}>123</span>
                      <span className={/[^A-Za-z0-9]/.test(password) ? 'text-emerald-400' : ''}>@#$</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Password Confirm */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Şifre Tekrar <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    className="block w-full px-4 py-3 pr-12 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="Şifrenizi tekrar girin"
                  />
                  {passwordConfirm.length > 0 && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {passwordsMatch ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Terms Checkbox */}
            {isRegister && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                  <Shield className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
                  Kişisel verilerimin işlenmesini ve <span className="text-indigo-400 hover:underline">kullanım koşullarını</span> kabul ediyorum.
                </span>
              </label>
            )}

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all disabled:opacity-70 shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900/50 text-slate-500 backdrop-blur-sm">
                  {isRegister ? 'Zaten üye misiniz?' : 'Hesabınız yok mu?'}
                </span>
              </div>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(null); setPasswordConfirm(''); }}
                className="w-full flex justify-center py-3 px-4 border border-white/10 rounded-xl text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 transition-all focus:outline-none"
              >
                {isRegister ? 'Giriş Yap Ekranına Dön' : 'Yeni Hesap Oluştur'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
