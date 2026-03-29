# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

---

## [Unreleased]

### Eklendi
- Gratis.com için `GratisStore` adaptörü — en düşük (kampanya) fiyatı çeker
- `checkStock.ts`'te URL bazlı otomatik mağaza tespiti (`gratis.com` → `GratisStore`)
- Ürün ekleme ve düzenleme sayfalarına Gratis ve Hepsiburada seçenekleri
- `detectStore()` fonksiyonuna Gratis ve Hepsiburada URL tespiti

### Düzeltildi
- `tsconfig.json`'dan `tests/` ve `scripts/` klasörleri exclude edildi — Next.js build hatası giderildi
- `tests/manual/force_sync.ts` artık frontend build'ine dahil edilmiyor

---

## [0.1.0] — 2026-03

### Eklendi
- Trendyol, Amazon, Hepsiburada, Generic mağaza adaptörleri
- SQLite veritabanı (WAL mode) — `users`, `products`, `stock_history`, `price_alerts`, `notifications`, `system_settings` tabloları
- JWT tabanlı kimlik doğrulama (register, login, email verification)
- Cron bazlı periyodik stok kontrolü (default: her 10 dakika)
- Telegram bot bildirimleri
- Brevo/Resend email bildirimleri
- In-app bildirim sistemi
- Fiyat alarmları (hedef fiyat altına/üstüne düştüğünde bildir)
- Stok geçmişi grafikleri (Recharts)
- Admin paneli (kullanıcı yönetimi, sistem ayarları)
- Rate limiting, Helmet güvenlik başlıkları, Zod input validation
- Stok geçmişi otomatik temizleme (retention policy)
- Railway deployment (persistent SQLite volume)
- `concurrently` ile tek komutta frontend + backend başlatma
