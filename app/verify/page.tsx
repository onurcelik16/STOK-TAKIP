'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Loader2, CheckCircle2, XCircle, Mail, RotateCw, ArrowLeft } from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

export default function VerifyPage() {
    const router = useRouter();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        const token = sessionStorage.getItem('token');
        if (!token || !storedUser) {
            router.push('/login');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.is_verified) {
            router.push('/dashboard');
            return;
        }
        setUser(parsedUser);
    }, []);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);

        // Move to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        if (!/^\d+$/.test(pastedData)) return;

        const newCode = [...code];
        pastedData.split('').forEach((char, i) => {
            if (i < 6) newCode[i] = char;
        });
        setCode(newCode);
        inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
    };

    async function handleVerify(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const finalCode = code.join('');
        if (finalCode.length < 6) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: finalCode }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Doğrulama başarısız');
            }

            setSuccess('Hesabınız başarıyla doğrulandı!');

            // Update local user state
            if (user) {
                const updatedUser = { ...user, is_verified: true };
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
            }

            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        setResending(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(`${API_URL}/auth/resend-code`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Kod gönderilemedi');
            setSuccess('Yeni kod e-postanıza gönderildi.');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setResending(false);
        }
    }

    // Auto-verify when all digits are filled
    useEffect(() => {
        if (code.every(digit => digit !== '') && code.join('').length === 6) {
            handleVerify();
        }
    }, [code]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                </div>
                <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
                    Hesabınızı Doğrulayın
                </h2>
                <p className="mt-2 text-center text-sm text-slate-400 max-w-xs mx-auto">
                    <span className="text-indigo-400 font-medium">{user?.email}</span> adresine gönderdiğimiz 6 haneli kodu girin.
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-slate-900/50 backdrop-blur-xl py-10 px-6 shadow-2xl sm:rounded-3xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500"></div>

                    <form onSubmit={handleVerify} className="space-y-8">
                        <div className="flex justify-between gap-2 max-w-[320px] mx-auto">
                            {code.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={digit}
                                    onChange={(e) => handleChange(i, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(i, e)}
                                    onPaste={i === 0 ? handlePaste : undefined}
                                    className="w-12 h-14 bg-slate-800/50 border border-white/10 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                            ))}
                        </div>

                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <XCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || code.some(d => d === '')}
                            className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-2xl text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 group"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Kodu Doğrula
                                    <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <button
                            onClick={handleResend}
                            disabled={resending}
                            className="text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <RotateCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                            Kod gelmedi mi? Tekrar gönder
                        </button>

                        <button
                            onClick={() => {
                                sessionStorage.removeItem('token');
                                sessionStorage.removeItem('user');
                                router.push('/login');
                            }}
                            className="text-xs font-medium text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1.5"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Farklı hesapla giriş yap
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
