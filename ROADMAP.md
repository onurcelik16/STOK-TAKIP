# Stock Tracker — Yol Haritası

> Son güncelleme: Mart 2026 | Versiyon: 0.1.0

---

## Mevcut Durum

| Alan | Durum |
|---|---|
| Trendyol scraping | ✅ Çalışıyor |
| Amazon scraping | ✅ Çalışıyor |
| Generic scraping | ✅ Çalışıyor |
| Gratis scraping (en düşük fiyat) | ✅ Çalışıyor |
| Hepsiburada scraping | ⚠️ Store yazıldı, routing generic'e düşüyor |
| Telegram bildirimleri | ✅ Çalışıyor |
| Email bildirimleri (Brevo) | ✅ Çalışıyor |
| In-app bildirimler | ✅ Çalışıyor |
| Fiyat alarmları | ✅ Çalışıyor |
| Auth (JWT + bcrypt) | ✅ Çalışıyor |
| Admin paneli | ✅ Çalışıyor |
| Railway deploy | ✅ Aktif |
| Stok geçmişi grafikleri | ✅ Çalışıyor |

---

## Faz 1 — Kararlılık (Kısa Vadeli)

> Hedef: Mevcut sistemin güvenilir çalışması

- [ ] **CORS güvenliği** — `origin: true` yerine `FRONTEND_URL` env'den oku
  - Dosya: `src/server/app.ts:44`
- [ ] **Hepsiburada routing** — `checkStock.ts`'te `hepsiburada` → `HepsiburadaStore`'a yönlendir
  - Dosya: `src/server/jobs/checkStock.ts:13`
- [ ] **Env validation** — Eksik/hatalı env değişkenlerini başlangıçta Zod ile doğrula
  - Dosya: `src/index.ts`
- [ ] **Gratis fiyat doğrulama** — Gerçek ürünlerde test edip selector'ları güncelle
- [ ] **Price alert bildirimi** — `notifyPriceAlert` await zinciri eksik, kontrol et
  - Dosya: `src/server/services/notifier.ts`
- [ ] **`.env.example` dosyası oluştur** — Tüm değişkenleri belgele

---

## Faz 2 — Performans (Orta Vadeli)

> Hedef: Daha hızlı ve güvenilir scraping

- [ ] **Paralel ürün kontrolü** — Sıralı `for` döngüsü yerine `Promise.all` + concurrency limit (5)
  - Dosya: `src/server/jobs/checkStock.ts`
  - Etki: 100 ürün × 3s → ~1 dk'ya düşer (şu an ~5 dk)
- [ ] **Playwright entegrasyonu** — Amazon ve dinamik siteler için headless browser
  - `RENDER_BROWSER=true` env zaten var, implement edilmemiş
- [ ] **Request caching** — Aynı URL'ye 10 dk içinde çift istek gitmesin
- [ ] **Scraper User-Agent rotasyonu** — Tek UA yerine havuzdan rastgele seç

---

## Faz 3 — Kalite (Orta Vadeli)

> Hedef: Kod kalitesi ve test kapsamı

- [ ] **Unit testler** — Store adaptörleri için mock axios ile test
  - Öncelik: TrendyolStore, GratisStore, GenericStore
- [ ] **Integration testler** — DB + cron job akışı
- [ ] **`any` type'larını kaldır** — DB sorguları için typed wrapper
- [ ] **Fiyat extraction utils** — Üç store'da tekrarlanan `extractPrice()` fonksiyonunu `src/server/utils/price.ts`'e taşı
- [ ] **CI/CD** — GitHub Actions ile push'ta build + test

---

## Faz 4 — Yeni Özellikler (Uzun Vadeli)

> Hedef: Ürünü genişlet

- [ ] **Yeni mağaza: Zara** — Generic ile çoğu zaman çalışıyor, özel adaptör gerekebilir
- [ ] **Yeni mağaza: Nike TR** — Size bazlı stok takibi
- [ ] **Yeni mağaza: Boyner** — Generic fallback yeterli mi test et
- [ ] **Fiyat trend grafiği** — Dashboard'da 30/90 günlük min/max/avg chart
- [ ] **Ürün import (CSV/Excel)** — Toplu ürün ekleme
- [ ] **Webhook desteği** — Bildirim için özel URL (Slack, Discord vb.)
- [ ] **Kullanıcı bazlı cron interval** — Her kullanıcı kendi tarama sıklığını ayarlasın
- [ ] **Mobil bildirim** — PWA push notification

---

## Faz 5 — Ölçeklendirme (Uzak Vadeli)

> Hedef: Çok kullanıcılı production ortamı

- [ ] **SQLite → PostgreSQL** — Concurrent write bottleneck aşmak için
- [ ] **Redis cache** — Sık kontrol edilen ürünler için sonuç cache'leme
- [ ] **Kullanıcı bazlı rate limiting** — Token bucket (şu an global limit var)
- [ ] **Browserless.io entegrasyonu** — Playwright'ı remote browser servisiyle çalıştır
- [ ] **Monitoring** — Sentry (hata takibi) + healthchecks.io (cron izleme)
- [ ] **Log aggregation** — Pino logları → Logtail / Datadog

---

## Bilinen Kısıtlamalar

| Konu | Açıklama |
|---|---|
| Gratis kampanya fiyatı | JavaScript render'lı olabilir, HTTP scraping tutarsız sonuç verebilir |
| Amazon bot koruması | HTTP-only çalışıyor, bazı ürünlerde fiyat gelmiyor olabilir |
| Hepsiburada bot koruması | Güvenlik sayfasına düşüyor, `RENDER_BROWSER=true` gerekiyor |
| SQLite concurrent write | Yüksek eş zamanlı scraping'de WAL mode yeterli olmayabilir |
| Playwright binary | Railway'de ~300MB ek boyut, cold start süresini etkiliyor |
