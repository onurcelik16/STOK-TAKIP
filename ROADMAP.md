# Yol Haritası: E-posta Sistemi + Özellik Geliştirmeleri

Bu dokümanda: (1) E-posta sistemi (üye olurken + bildirim), (2) Madde 1–2–4–5 ile ilgili yapılacaklar, birkaç değişiklikle uygulanabilir şekilde planlanmıştır.

---

## Öncelik 0: E-posta Sistemi (Üyelik + Bildirim)

**Mevcut durum:** Resend entegre; `sendVerificationEmail` var ama kayıtta herkes otomatik doğrulanıyor, mail gönderilmiyor. Stok/fiyat bildirimleri sadece Telegram + panel bildirimi.

### A. Üyelik / Doğrulama Tarafı

| Adım | Açıklama |
|------|----------|
| 1 | **Doğrulama akışını açmak (opsiyonel)** – `auth/routes`: Kayıt sonrası `is_verified = 0` yap; `sendVerificationEmail(email, code)` çağır; login’de `is_verified === 0` ise token ver ama panelde “E-postanı doğrula” ekranına yönlendir. |
| 2 | **Hoş geldin e-postası** – Yeni kullanıcıya (doğrulasın veya doğrulamasın) “Hesabın hazır” + panel linki içeren bir `sendWelcomeEmail(email, name)` ekle; register sonrası tek sefer gönder. |
| 3 | **Resend / env** – Canlıda `RESEND_API_KEY`, `EMAIL_FROM` (onaylı domain) tanımlı olsun. Gerekirse `email.ts` içinde Resend hata durumunda loglayıp sessizce devam et (panel/Telegram yine çalışsın). |

### B. Bildirim Tarafı (E-posta)

| Adım | Açıklama |
|------|----------|
| 4 | **Stok değişimi e-postası** – `notifier.ts`: `notifyChange` içinde ürün sahibinin `email`’ini al; Resend ile kısa HTML mail at (“Ürün stokta / tükendi”, ürün adı, fiyat, link). Telegram + in-app bildirim aynen kalsın. |
| 5 | **Fiyat alarmı e-postası** – `notifyPriceAlert` içinde aynı şekilde kullanıcıya mail at (hedef fiyat, güncel fiyat, link). |
| 6 | **Tercih alanı (opsiyonel)** – `users` tablosuna `email_notifications` (0/1) ekle; ayarlar sayfasından “Bildirimleri e-posta ile al” aç/kapa. Mail atmadan önce bu bayrağı kontrol et. |

**Kod yerleri:**  
- Üyelik: `src/server/routes/auth.ts`, `src/server/utils/email.ts`  
- Bildirim: `src/server/services/notifier.ts`  
- Tercih: migration + ayarlar sayfası (ör. `app/settings/page.tsx` veya profil)

---

## Madde 1: Ürün / Kullanıcı Değeri (Birkaç Değişiklik)

| Özellik | Kısa Açıklama |
|---------|----------------|
| **Bildirim kanalları** | E-posta (yukarıda). İleride: Web push veya Slack/Discord webhook için endpoint + ayarlar alanı. |
| **Fiyat analizi** | Ürün detayda “Son 30 günde min/ortalama/max fiyat” bilgisini API’den döndür (tek SQL ile); panelde küçük bir bilgi kutusu. |
| **Toplu içe aktarma** | CSV’den URL listesi okuyup `POST /products` ile toplu ekleme endpoint’i (admin veya kullanıcı limitiyle). |
| **Workspace / ekip** | İlk aşamada sadece “ürün listesini başka kullanıcıyla paylaş” (read-only link veya davet kodu) ile basit paylaşım; tam rol/workspace sonra. |

---

## Madde 2: Teknik / Altyapı (Birkaç Değişiklik)

| Özellik | Kısa Açıklama |
|---------|----------------|
| **Monitoring** | `/health` zaten var. Ek: UptimeRobot/Healthchecks.io ile dış ping; kritik hatalarda Telegram veya e-posta ile “ops” bildirimi (ör. `index.ts` global handler’dan). |
| **Veritabanı** | Şimdilik SQLite. İleride Postgres’e geçiş için: veri erişimini tek katmanda topla (repository/service), SQL’i bu katmandan kullan. |
| **Job ayrıştırma** | Şimdilik tek process. İleride: API servisi + worker servisi (cron + scraper) ayrı deploy edilebilir. |
| **Cache / limit** | Sık kullanılan “son durum” sorguları için kısa TTL in-memory cache (opsiyonel); auth ve kritik endpoint’lerde rate limit zaten var, gerekirse sıkılaştır. |

---

## Madde 4: Panel / UX (Birkaç Değişiklik)

| Özellik | Kısa Açıklama |
|---------|----------------|
| **Filtreleme** | Ürün listesinde hazır filtreler: “Son 24 saatte fiyatı düşenler”, “Stokta olanlar”, “Tükenenler”. Backend’de query parametresi, frontend’de sekme veya dropdown. |
| **Mobil** | Kart listesini mobilde daha sade yap; history tablolarında mobilde “card” görünümü (satır yerine kart). |

---

## Madde 5: İş / Ürünleştirme (Birkaç Değişiklik)

| Özellik | Kısa Açıklama |
|---------|----------------|
| **Plan / limit** | Zaten `product_limit` var. Free/Pro ayrımı: Free’de X ürün, Y dakikada bir kontrol; Pro’da daha sık tarama, daha fazla ürün, e-posta + Telegram. Plan bilgisini `users` veya `system_settings` üzerinden tut. |
| **Kullanım istatistikleri** | Admin paneline “Aktif kullanıcı, toplam ürün, tetiklenen alarm sayısı” grafikleri (mevcut istatistik endpoint’leri genişletilerek). |
| **Geri bildirim** | Panelde “Geri bildirim gönder” linki veya basit form; mailto veya basit bir API ile kaydedip admin’e mail at. |

---

## Önerilen Sıra

1. **E-posta:** Önce bildirim (stok + fiyat alarmı mail), sonra istenirse doğrulama + hoş geldin maili ve tercih alanı.  
2. **Madde 1:** E-posta bildirimleri tamamlandıktan sonra fiyat analizi + toplu import.  
3. **Madde 4:** Filtreleme + mobil iyileştirme.  
4. **Madde 2:** Monitoring/alerting, gerekirse cache.  
5. **Madde 5:** Plan/limit netleştirme, istatistikler, geri bildirim.

Bu sırayla ilerlersen hem “mail sistemi yok” ihtiyacı hem de 1–2–4–5’teki geliştirmeler birkaç değişiklikle adım adım uygulanabilir.
