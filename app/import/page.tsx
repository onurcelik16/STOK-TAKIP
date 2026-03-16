'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Plus, Trash2, Link2 } from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

type ImportResult = {
  added: number;
  skipped: number;
  errors: string[];
};

export default function ImportPage() {
  const router = useRouter();
  const [urls, setUrls] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseUrls(text: string): string[] {
    return text
      .split(/[\n,;]+/)
      .map(line => line.trim())
      .filter(line => line.startsWith('http'));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Try to extract URLs from CSV content
      const lines = text.split(/[\n\r]+/).filter(l => l.trim());

      // Check if first line is a header
      const firstLine = lines[0]?.toLowerCase();
      const startIdx = firstLine && (firstLine.includes('url') || firstLine.includes('link') || firstLine.includes('adres')) ? 1 : 0;

      const extracted = lines.slice(startIdx).map(line => {
        // Try first column or find any URL in the line
        const parts = line.split(/[,;\t]+/);
        for (const part of parts) {
          const val = part.trim().replace(/^["']|["']$/g, '');
          if (val.startsWith('http')) return val;
        }
        return '';
      }).filter(Boolean);

      setUrls(prev => {
        const existing = prev.trim();
        return existing ? `${existing}\n${extracted.join('\n')}` : extracted.join('\n');
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleImport() {
    const urlList = parseUrls(urls);
    if (urlList.length === 0) {
      setError('En az bir geçerli URL girin');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const items = urlList.map(url => ({
        url,
        category: category || undefined,
        tags: tags || undefined,
      }));

      const res = await fetch(`${API_URL}/products/bulk-import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'İçe aktarma başarısız');
      }

      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const urlCount = parseUrls(urls).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products" className="p-2 bg-white text-slate-500 hover:text-slate-900 rounded-lg shadow-sm border border-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Upload className="w-6 h-6 text-indigo-500" />
              Toplu Ürün Ekle
            </h1>
            <p className="text-sm text-slate-500 mt-1">Birden fazla ürünü tek seferde ekleyin.</p>
          </div>
        </div>
      </div>

      {/* Result Banner */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-emerald-800">İçe aktarma tamamlandı!</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-700"><strong>{result.added}</strong> ürün eklendi</span>
            {result.skipped > 0 && <span className="text-amber-700"><strong>{result.skipped}</strong> atlandı (mükerrer/geçersiz)</span>}
          </div>
          {result.errors.length > 0 && (
            <div className="text-xs text-rose-600 mt-1">{result.errors.join(' · ')}</div>
          )}
          <button
            onClick={() => router.push('/products')}
            className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Ürünlere Git →
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        {/* URL Textarea */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Link2 className="w-4 h-4 inline mr-1 text-slate-400" />
            Ürün URL'leri
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={"https://www.trendyol.com/urun-1\nhttps://www.trendyol.com/urun-2\nhttps://www.amazon.com.tr/urun-3"}
            rows={8}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono resize-y"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-slate-400">Her satıra bir URL yazın veya virgülle ayırın</span>
            {urlCount > 0 && (
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{urlCount} URL algılandı</span>
            )}
          </div>
        </div>

        {/* CSV Upload */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:bg-white hover:border-indigo-200 transition"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            CSV Dosyası Yükle
          </button>
          <span className="text-xs text-slate-400">veya URL'leri yukarıya yapıştırın</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Optional Settings */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kategori (tümüne uygulanır)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white"
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Etiketler (tümüne uygulanır)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none"
              placeholder="ör: indirim, hediye"
            />
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={loading || urlCount === 0}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {urlCount} Ürünü İçe Aktar
            </>
          )}
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">💡 İpuçları</h3>
        <ul className="text-xs text-slate-500 space-y-1.5 leading-relaxed">
          <li>• Mağaza tipi URL'den otomatik algılanır (Trendyol, Amazon, Diğer)</li>
          <li>• Zaten eklenmiş URL'ler otomatik atlanır</li>
          <li>• CSV dosyanızda URL'lerin bir sütunda olması yeterli</li>
          <li>• Ürün limiti aşılırsa fazla URL'ler eklenmez</li>
        </ul>
      </div>
    </div>
  );
}
