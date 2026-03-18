# Stock Tracker — Canlıya Geçiş (Production) Kontrol Listesi

Projeyi gerçek bir sunucuda (VPS, Heroku, Render vb.) çalıştırmadan önce aşağıdaki adımları tamamladığınızdan emin olun.

## 1. Ortam Değişkenleri (.env)
Yerel geliştirme ortamındaki `.env` dosyanızdaki verileri sunucuya güvenli bir şekilde aktarın. 
> [!IMPORTANT]
> `JWT_SECRET` değerini mutlaka tahmin edilemez, uzun bir rastgele karakter dizisiyle değiştirin.

Gerekli değişkenler:
| Değişken | Açıklama | Örnek |
| :--- | :--- | :--- |
| `PORT` | Backend sunucu portu | `3000` |
| `JWT_SECRET` | Login tokenları için anahtar | `gizli_anahtar_123` |
| `TELEGRAM_BOT_TOKEN` | @BotFather'dan alınan token | `123:ABC...` |
| `TELEGRAM_BOT_USERNAME`| Bot kullanıcı adı | `BotumunAdi` |
| `DB_PATH` | Veritabanı dosya yolu | `./data/app.sqlite` |
| `CORS_ORIGIN` | İzin verilen Frontend URL (Backend için) | `https://site.com` |
| `NEXT_PUBLIC_API_URL` | Erişilebilir API URL (Frontend için) | `https://api.site.com` |
| `CRON` | Arka plan tarama sıklığı | `*/10 * * * *` |
| `BREVO_API_KEY` | **Önerilen.** Brevo API anahtarı (ücretsiz planda günde 300 mail, **herkese** gönderim) | `xkeysib-...` |
| `EMAIL_FROM` | Gönderici e-posta (Brevo/Resend’te onaylı adres) | `bildirim@site.com` |
| `EMAIL_FROM_NAME` | Gönderici adı (opsiyonel) | `Stock Tracker` |
| `RESEND_API_KEY` | Alternatif: Resend API (ücretsiz planda sadece kendi adresinize gönderim) | `re_123...` |

**E-posta:** Birden fazla kullanıcıya (kayıt doğrulama, stok/fiyat bildirimi) mail atmak için **Brevo** kullanın: [brevo.com](https://www.brevo.com) → hesap → SMTP & API → API Key. `BREVO_API_KEY` tanımlıysa mailler Brevo ile gider (herhangi bir alıcıya). Tanımlı değilse Resend kullanılır (Resend ücretsiz planda sadece kendi e-postanıza gönderir).

| `FRONTEND_URL` | Panel URL (hoş geldin mailindeki “Panele Git” linki) | `https://stok-takip-six.vercel.app` |
| `REQUIRE_EMAIL_VERIFICATION` | `true` ise yeni üyeler e-posta doğrulama yapar; doğrulayana kadar panele tam erişemez | (boş = doğrulama yok, hoş geldin maili hemen gider) |

## 2. Derleme (Build) Adımı
Proje hem backend hem frontend içerdiği için derlenmesi gerekir:
```bash
# Backend derleme (dist klasörünü oluşturur)
npm run build

# Frontend derleme (.next klasörünü oluşturur)
npx next build
```

## 3. Süreç Yönetimi (Process Management)
Sunucuda uygulamanın çökmesi durumunda otomatik yeniden başlaması ve arka planda çalışması için `pm2` önerilir:
```bash
# Kurulum
npm install -g pm2

# API Server Başlatma
pm2 start dist/index.js --name "stock-api"

# Web (Next.js) Başlatma
pm2 start "npm run start:web" --name "stock-web"
```
> [!NOTE]
> `package.json` dosyanıza `"start:web": "next start -p 3001"` komutunu eklemeniz önerilir.

## 4. Güvenlik ve Optimizasyon
- **Rate Limit:** Giriş ve kayıt sayfalarında hız sınırı aktiftir. Sunucuda kendi IP'nizi engellememeye dikkat edin.
- **Resend Domain:** Canlıda `onboarding@resend.dev` yerine kendi domaininizi Resend üzerinden onaylatıp kullanmanız önerilir.
- **SQLite:** `data/` klasörünün yazma izinlerine sahip olduğundan emin olun.
- **Hosting (Render Uyarısı):** Eğer Render kullanacaksanız, SQLite dosyası sunucu her kapandığında sıfırlanır. Canlıda verilerin silinmemesi için Render'da "Disk" (Persistent Storage) eklemeniz veya Render yerine SQLite verilerini silmeyen **Railway** veya bir **VPS** (DigitalOcean, Hetzner vb.) kullanmanız önerilir.
- **Privacy:** Telegram botunuzun "Privacy Mode" ayarını BotFather'dan kontrol edin.

## 5. Adım Adım Ücretsiz Yayına Alma (Önerilen)

### A. Backend (API & Data) - Railway.app
1. [Railway.app](https://railway.app)'e GitHub ile giriş yapın.
2. **"New Project"** → **"Deploy from GitHub repo"** diyerek bu projeyi seçin.
3. **Settings** sekmesinden **"Volumes"** kısmına gelin ve `/data` klasörü için bir disk ekleyin (Bu adım verilerin silinmemesi için çok kritik).
4. **Variables** sekmesine `.env` dosyasındaki tüm değerleri ekleyin.
5. Railway size bir URL verecek (Örn: `https://stock-api.up.railway.app`). Bunu kopyalayın.

### B. Frontend (Panel) - Vercel.com
1. [Vercel.com](https://vercel.com)'a giriş yapın.
2. Projeyi GitHub'dan içe aktarın.
3. **Environment Variables** kısmına şunları ekleyin:
   - `NEXT_PUBLIC_API_URL`: (Az önce Railway'den aldığınız URL)
4. **Deploy** butonuna basın. Vercel size panelin adresini verecek (Örn: `https://stok-takip.vercel.app`).

### C. Son Bağlantı
- Railway'deki **Variables** kısmına geri dönün.
- `CORS_ORIGIN` değişkenini Vercel'in verdiği adresle güncelleyin.
- Artık her şey hazır!
