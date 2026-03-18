# Stock Tracker — Kod Analizi ve Yapı İncelemesi

**Proje Adı:** Stock Tracker (OTO)  
**Teknoloji Stack:** Next.js 15 (Frontend) + Node.js/Express (Backend) + SQLite (Database)  
**Amaç:** E-ticaret sitelerinden ürün stok/fiyat verisi otomatik olarak tarayıp izlemek, bildirim göndermek.

---

## 1. Mimari Genel Bakış

### 1.1 Mono-Repo Yapısı

```
oto/
├── src/
│   ├── index.ts              (Backend entry point)
│   ├── server/               (Express API)
│   │   ├── app.ts            (Middleware + routes setup)
│   │   ├── routes/           (API endpoints: /auth, /products, /admin, etc.)
│   │   ├── jobs/             (Cron tasks: checkStock.ts)
│   │   ├── middleware/       (Auth, rate limit)
│   │   ├── services/         (Telegram, email notifier)
│   │   ├── stores/           (Mağaza adapterleri)
│   │   ├── utils/            (Logger, email helper)
│   │   └── data/
│   │       └── db.ts         (SQLite schema + helpers)
│   └── lib/
│       └── utils.ts
├── app/                      (Next.js App Router frontend)
│   ├── layout.tsx            (Auth guard + sidebar layout)
│   ├── page.tsx              (Home)
│   ├── login/, register/, etc. (Auth pages)
│   ├── dashboard/            (Dashboard)
│   ├── products/             (Product list + detail pages)
│   ├── admin/                (Admin panel)
│   └── ...
├── components/               (Reusable React components)
├── scripts/                  (CLI utilities)
├── tests/                    (Basic API tests)
├── data/                     (SQLite database & docs)
├── next.config.mjs           (Next.js config)
├── tsconfig.json, tsconfig.server.json
├── tailwind.config.mjs       (Styling)
├── package.json              (Dependencies + scripts)
└── README.md, ROADMAP.md, production_readiness.md
```

**Önemli:** Frontend ve backend **aynı repo içinde** ama **farklı işlemler** olarak çalışıyor:
- **Backend:** `npm run dev:api` → port 3000 (Express)
- **Frontend:** `npm run dev:web` → port 3001 (Next.js dev server)
- **İkisi birlikte:** `npm run dev:all` (concurrently)

---

## 2. Veri Akışı (Data Flow)

### 2.1 Başlatma Süreci

```
1. node src/index.ts
   ↓
2. Env variables yükle (dotenv/config)
   ↓
3. ensureDatabaseInitialized()
   → SQLite DB oluştur/migrate (WAL mode)
   → Schema: users, products, stock_history, price_alerts, notifications, system_settings
   ↓
4. createServer() (Express app)
   → Middleware: CORS, helmet, morgan, logger
   → Routes kayıt: /auth, /products, /admin, /notifications, /proxy
   ↓
5. scheduleStockChecks()
   → node-cron job başlat (default: */10 * * * * = her 10 dakika)
   ↓
6. startTelegramBot()
   → Telegram bot dinle (opsiyonel)
   ↓
7. Server listen on 0.0.0.0:3000
```

### 2.2 Periyodik Stok Kontrol Süreci (Cron Job)

```
scheduleStockChecks() [src/server/jobs/checkStock.ts]
  ↓
Tüm ürünleri DB'den oku:
  - SELECT id, url, store, selector, size, name, image_url FROM products
  ↓
Her ürün için loop:
  ↓
1. Mağaza türüne göre scraper seç:
   ├─ 'trendyol'        → TrendyolStore (JSON-LD + variant parsing)
   ├─ 'amazon'          → AmazonStore (Cheerio + JSON-LD)
   ├─ 'hepsiburada'/'generic'/'other' → GenericStore (Cheerio + JSON-LD fallback)
   └─ default           → DemoStore (mock/selector-based)

2. Scraper'ı çalıştır (timeout: 60s, configurable):
   ├─ HTTP request gönder (axios)
   ├─ HTML parse'i (cheerio)
   ├─ JSON-LD script tags'ı çıkart
   ├─ Fiyat + stok durumu ekstract et
   ├─ (Trendyol) Size variant match'i kontrol et
   └─ Return: { inStock: bool, price: number?, source: 'http'|'browser', ... }

3. Sonuçları stock_history tablosuna kaydet:
   INSERT INTO stock_history (product_id, in_stock, price, checked_at, source, size)
   VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?)

4. Ürün bilgisini güncelle (eğer scraper'dan gelen veri varsa):
   UPDATE products SET name = ?, image_url = ? WHERE id = ?

5. Stok değişimini tespit et:
   ├─ Eğer last_status ≠ current_status → bildirim gönder
   └─ notifyChange() çağır

6. Fiyat uyarılarını kontrol et:
   SELECT * FROM price_alerts WHERE product_id = ? AND is_active = 1
   ├─ Eğer (direction='below' AND price <= target) OR (direction='above' AND price >= target)
   │  → Alert tetikle, bildirim gönder, uyarıyı deaktif et
   └─ notifyPriceAlert() çağır

7. Sonuçları logla:
   logger.info({ productId, store, durationMs, ... }, '[cron] product check completed')
   
Ayrıca: Eski stock_history satırlarını sil (retention policy: env STOCK_HISTORY_RETENTION_DAYS)
```

### 2.3 Bildirim Süreci (notifier.ts)

```
notifyChange() / notifyPriceAlert()
  ↓
1. IN-APP notification:
   INSERT INTO notifications (user_id, type, title, message, product_id)
   VALUES (?, 'stock_available'|'stock_unavailable', ?, ?, ?)
   
2. Telegram bildirim (eğer telegram_chat_id ayarlıysa):
   POST https://api.telegram.org/bot{TOKEN}/sendMessage
   {
     chat_id: user.telegram_chat_id,
     text: "🟢 Stok Değişimi\n🏬 Mağaza: TRENDYOL\n📦 Durum: STOKTA\n💰 Fiyat: 199.99 ₺\n🔗 [Link]",
     parse_mode: "HTML"
   }

3. Email bildirim (eğer email_notifications=1 ve BREVO_API_KEY ayarlıysa):
   sendNotificationEmail()
   → Brevo API çağrı (resend package)
```

---

## 3. Mağaza Adapterleri (Store Pattern)

### 3.1 Interface (`StoreScraper`)

```typescript
export interface StoreScraper {
  name: string;
  checkProduct: (args: {
    url: string;
    selector?: string | null;
    size?: string | null;
  }) => Promise<ProductCheckResult>;
}

export type ProductCheckResult = {
  inStock: boolean;
  price?: number | null;
  source?: 'http' | 'browser';
  size?: string | null;
  productName?: string | null;
  imageUrl?: string | null;
};
```

### 3.2 Implementasyonlar

#### **TrendyolStore** (`src/server/stores/trendyol/TrendyolStore.ts`)

**Özellikler:**
- JSON-LD script tags'ından veri çıkar
- Variant (beden) searching: size parametresi verilirse, exact match aramak
- Fallback: global script tag'ında `variants` array'ini bulup parse et
- Regex fallback: "TL" ile biçimlendirilen fiyatları ekstract et

**Akış:**
1. HTTP GET (Cheerio)
2. JSON-LD → hasVariant, offers, availability, price
3. Size match → product.offers.availability = "InStock" / "OutOfStock"
4. Fiyat çıkarma: `findPriceDeep()` recursive arama

**Dikkat:** Kompleks variant matching — eğer size varsa, variant'ı bulamıyorsa, **default inStock=false** yapıyor (conservative approach).

#### **AmazonStore** (`src/server/stores/amazon/AmazonStore.ts`)

**Özellikler:**
- Availability text check: "stokta", "mevcut değil", vb.
- Add-to-cart button presence
- Multiple price selectors (Amazon çeşitli CSS class'ları kullanıyor)
- JSON-LD fallback

**Dikkat:** Amazon dynamic content yüklyebilse de, şu an **HTTP-only** (Playwright yok — yorum: "// Strategy 2: Browser rendering not implemented for Amazon").

#### **GenericStore** (`src/server/stores/generic/GenericStore.ts`)

**Özellikler:**
- Universal JSON-LD parser (findProducts recursive)
- Turkish price format handling: "1.234,56 TL" → 1234.56
- Size-aware offer matching
- Fallback: HTML element selectors

**Fiyat regex patterns:**
1. Turkish format: `([0-9]{1,3}(?:\.[0-9]{3})*[,][0-9]{2})`
2. Comma-decimal: `([0-9]+)[,]([0-9]{2})`
3. International: `([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})`
4. Plain number: `([0-9]+(?:\.[0-9]{1,2})?)`

#### **DemoStore** (`src/server/stores/examples/DemoStore.ts`)

**Amaç:** Testing / development. Eğer selector varsa, CSS selector'a göre karar veriyor.

---

## 4. Veritabanı Şeması

### 4.1 Tables

#### `users`
```sql
id INTEGER PRIMARY KEY
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL (bcryptjs)
name TEXT
role TEXT DEFAULT 'user' -- 'user' | 'admin'
telegram_chat_id TEXT -- Telegram bot integration
telegram_verify_code TEXT UNIQUE
is_verified INTEGER DEFAULT 0 -- Email verification
verification_code TEXT
created_at TEXT DATETIME
```

#### `products`
```sql
id INTEGER PRIMARY KEY
user_id INTEGER (FK: users.id)
url TEXT NOT NULL
store TEXT NOT NULL -- 'trendyol', 'amazon', 'generic', etc.
selector TEXT -- Özel CSS selector (optional)
size TEXT -- Boyut variant (optional)
name TEXT -- Bot tarafından otomatik doldurulabiliyor
image_url TEXT
category TEXT
tags TEXT
created_at TEXT DATETIME
```

#### `stock_history` ⭐ (En kritik tablo — analytics için)
```sql
id INTEGER PRIMARY KEY
product_id INTEGER NOT NULL (FK: products.id ON DELETE CASCADE)
in_stock INTEGER NOT NULL -- 0 | 1
price REAL
checked_at TEXT DATETIME DEFAULT (datetime('now', 'localtime'))
source TEXT -- 'http' | 'browser' (scraper method bilgisi)
size TEXT -- Kontrolün yapıldığı boyut

INDEX: idx_stock_history_product_time (product_id, checked_at DESC)
```

**Boyut:** Zamanla büyüyebiliyor (retention policy var: `STOCK_HISTORY_RETENTION_DAYS` env).

#### `price_alerts`
```sql
id INTEGER PRIMARY KEY
user_id INTEGER NOT NULL (FK: users.id)
product_id INTEGER NOT NULL (FK: products.id)
target_price REAL NOT NULL
direction TEXT DEFAULT 'below' -- 'below' | 'above'
is_active INTEGER DEFAULT 1
created_at TEXT DATETIME
triggered_at TEXT -- Tetiklenme zamanı
```

#### `notifications`
```sql
id INTEGER PRIMARY KEY
user_id INTEGER NOT NULL
type TEXT -- 'stock_available' | 'stock_unavailable' | 'price_alert'
title TEXT
message TEXT
is_read INTEGER DEFAULT 0
product_id INTEGER (FK: products.id)
created_at TEXT DATETIME
```

#### `system_settings`
```sql
key TEXT PRIMARY KEY
value TEXT
-- Örnek kayıtlar:
-- 'cron_interval' → '*/10 * * * *'
-- 'product_limit' → '10'
```

### 4.2 WAL Mode
```typescript
db.pragma('journal_mode = WAL');
```
Write-Ahead Logging → **concurrent reads allowed while writing**.

---

## 5. API Endpoints

### Authentication
- `POST /auth/register` – Kaydol (email + password)
- `POST /auth/login` – Giriş yap (session storage token)
- `POST /auth/verify` – Email doğrula

### Products
- `GET /products` – Current user'ın tüm product'ları (admin: ?all=true)
- `GET /products/:id` – Detay + stock_history (time range: ?days=7|30|90|all)
- `POST /products` – Yeni ürün ekle
  ```json
  {
    "url": "string",
    "store": "string",
    "selector": "string?",
    "size": "string?",
    "name": "string?",
    "category": "string?",
    "tags": "string?"
  }
  ```
- `PUT /products/:id` – Güncelle
- `DELETE /products/:id` – Sil (cascade stock_history'ler)

### Admin
- `GET /admin/stats` – System stats (product count, check rate, vb.)
- `POST /admin/settings` – System setting güncelle
- `GET /admin/users` – Tüm users (admin only)

### Notifications
- `GET /notifications` – User'ın notifications (paginated)
- `PATCH /notifications/:id/read` – Mark as read

### Proxy (Debug)
- `GET /proxy?url=...` – URL'ye proxy request (security: localhost only)

### Health
- `GET /health` – DB connection check
- `GET /` – Endpoint listesi

---

## 6. Frontend (Next.js) Mimarisi

### 6.1 Layout & Auth Guard (`app/layout.tsx`)

```typescript
'use client';

1. sessionStorage'dan token oku
2. Eğer özel sayfa değilse:
   ├─ Token yoksa → /login'e yönlendir
   └─ User unverified ise → /verify'ye yönlendir
3. Sidebar + Header ile wrap et
4. children render et
```

**Public pages:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`  
**Verify page:** `/verify` (authenticated but unverified)  
**Protected pages:** Everything else

### 6.2 Key Pages

- **`/`** – Home / landing
- **`/login`, `/register`** – Auth
- **`/dashboard`** – Main user dashboard
- **`/products`** – Product list
- **`/products/[id]`** – Single product detail + stock_history chart
- **`/admin`** – Admin dashboard (stats, user mgmt)
- **`/admin/settings`** – System settings
- **`/admin/users/[id]/products`** – User's products (admin view)
- **`/settings`** – User settings

### 6.3 Components

- **`Sidebar`** – Navigation menu
- **`Header`** – User info + logout
- **`NotificationBell`** – Real-time notifications

### 6.4 Styling

- **Tailwind CSS** – Utility-first CSS
- **Lucide React** – Icon library
- **Recharts** – Data visualization (stock history graphs)

---

## 7. Bağımlılıklar (Dependencies) — Özet

### Core
| Package | Versiyon | Amaç |
|---------|----------|------|
| `express` | 4.21.1 | Web framework |
| `next` | 15.5.9 | React metaframework (SSR, routing) |
| `better-sqlite3` | 9.6.0 | Sync SQLite client (optional) |
| `typescript` | 5.6.3 | Type safety |
| `react`, `react-dom` | 18.3.1 | UI library |

### Web Scraping & Parsing
| Package | Versiyon | Amaç |
|---------|----------|------|
| `playwright` | 1.48.2 | Headless browser automation |
| `cheerio` | 1.0.0 | Fast jQuery-like HTML parser |
| `axios` | 1.7.7 | HTTP client |

### Utilities
| Package | Versiyon | Amaç |
|---------|----------|------|
| `node-cron` | 3.0.3 | Scheduled tasks |
| `jsonwebtoken` | 9.0.2 | JWT auth tokens |
| `bcryptjs` | 2.4.3 | Password hashing |
| `dotenv` | 16.4.5 | Env variables |
| `zod` | 3.23.8 | Schema validation |
| `pino`, `pino-pretty` | 10.3.1, 13.1.3 | Structured logging |
| `morgan` | 1.10.1 | HTTP request logger |

### UI
| Package | Versiyon | Amaç |
|---------|----------|------|
| `tailwindcss` | 3.4.11 | CSS utility framework |
| `lucide-react` | 0.575.0 | Icon components |
| `recharts` | 3.7.0 | Chart library |

### Dev
| Package | Versiyon | Amaç |
|---------|----------|------|
| `tsx` | 4.19.1 | TypeScript executor |
| `concurrently` | 9.1.0 | Parallel process runner |

---

## 8. Güvenlik Gözlemleri

### ✅ Yapılan Doğru Şeyler
1. **Password hashing:** bcryptjs kullanılıyor
2. **JWT tokens:** Session-based auth
3. **Rate limiting:** `express-rate-limit` middleware
4. **SQL injection:** `better-sqlite3` prepared statements
5. **Helmet:** Security headers setup
6. **Zod validation:** Input validation

### ⚠️ Dikkat, İmprovement Gereken Alanlar (Production için)

1. **CORS:** `origin: true` — **herhangi bir origin'den request kabul ediyor!**
   ```typescript
   // VULNERABLE:
   app.use(cors({ origin: true, credentials: true }));
   
   // SHOULD BE:
   app.use(cors({ 
     origin: process.env.FRONTEND_URL || 'http://localhost:3001',
     credentials: true 
   }));
   ```

2. **Helmet policy:** Cross-origin policy azaltılmış (debug amaçlı)
   ```typescript
   // REDUCED:
   helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })
   
   // SHOULD BE:
   helmet({ crossOriginResourcePolicy: { policy: "same-site" } })
   ```

3. **JSON size limit:** 10KB — payloads için yetersiz olabilir
   ```typescript
   express.json({ limit: '10kb' }) // ← Small limit
   
   // Consider:
   express.json({ limit: '1mb' }) // Or size-based on needs
   ```

4. **Logging verbosity:** `morgan('dev')` + custom logger — prod'da noise
   ```typescript
   // Prod'da info level kullanılmalı, debug disabled
   ```

5. **env validation:** .env dosyası, tüm required vars'lar kontrol edilmeli
   ```typescript
   // Missing: process.env validation (zod, joi, vb.)
   const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
   // Better: z.coerce.number().parse(process.env.PORT)
   ```

6. **Playwright browser:** Headless browser'ın binary size'ı ve security implications
   - `postinstall: npx playwright install chromium` — CI/production'da resource costly
   - Solution: Use playwright service / remote browser (Browserless.io, etc.)

7. **Database:** SQLite — single-file database
   - **Dev/test:** OK
   - **Production:** PostgreSQL / MySQL önerilir (concurrent writes, backups, WAL limitations)

8. **Error messages:** Generic error messages (good), but logs should be secure
   - e.g., `res.status(500).json({ error: 'Something went wrong' })` ✅

---

## 9. Performans Gözlemleri

### ✅ İyi Uygulamalar
1. **Timeout handling:** 60s default, configurable `SCRAPER_TIMEOUT_MS`
2. **Request timing logging:** Duration ms for each product check
3. **Database indices:** `idx_stock_history_product_time` → fast historical queries
4. **Concurrent prevention:** `isChecking` flag — overlapping cron jobs prevented
5. **Old data cleanup:** `pruneOldStockHistory()` — DB size management

### ⚠️ Potential Bottlenecks

1. **Playwright overhead:** Not used (commented as "not implemented for Amazon")
   - Trendyol variant matching relies on HTTP + JSON-LD parsing
   - Some sites may need headless browser — resource intensive

2. **Sequential product checking:**
   ```typescript
   for (const p of products) {
     // Each product checked one at a time
     const result = await withTimeout(
       scraper.checkProduct(...),
       timeoutMs,
       ...
     );
   }
   ```
   **Better:** Batch requests (Promise.all) with concurrency control
   ```typescript
   const concurrency = 5; // parallel checks
   const batches = chunk(products, concurrency);
   await Promise.all(batches.map(p => scraper.checkProduct(p)));
   ```

3. **Response time per product:**
   - HTTP request: 1-5s
   - HTML parse: 10-100ms
   - If 100 products × 3s avg = **5 minutes per cycle!**
   - Solution: Increase concurrent scrapers

4. **Stock history table growth:**
   - Example: 50 products × 6 checks/day = 300 rows/day
   - 1 year = ~110k rows
   - Index critical!

---

## 10. Testing & Quality

### Current State
- **Unit tests:** Minimal (`tests/basic-api.test.mjs` basic sanity check only)
- **Integration tests:** None
- **E2E tests:** None

### Scratchpad Test Files (Root)
```
test_trendyol.ts
test_trendyol_pw.ts (Playwright)
test_generic.ts
test_amazon.ts
test_db.js
test_scraper.ts
... (many manual test files)
```

**Observation:** Development-time test files, not part of CI/CD.

### Recommendations

1. **Unit tests:** Store adapters (mocked axios responses)
2. **Integration tests:** Database + job scheduler
3. **E2E tests:** Frontend + API (user flow)
4. **Mock server:** For scraper testing (Playwright Interceptor)

---

## 11. Deployment & Configuration

### Environment Variables (Required/Optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | - | 'development' \| 'production' |
| `PORT` | 3000 | Backend API port |
| `DB_PATH` | `./data/app.sqlite` | SQLite file location |
| `CRON` | `*/10 * * * *` | Cron interval (10 min) |
| `SCRAPER_TIMEOUT_MS` | 60000 | Scraper timeout |
| `STOCK_HISTORY_RETENTION_DAYS` | - | Automatic prune (optional) |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot integration |
| `BREVO_API_KEY` | - | Email service (resend) |
| `JWT_SECRET` | - | Session token signing |
| `RENDER_BROWSER` | false | Playwright browser enable (not implemented) |

### Build & Run

```bash
# Development
npm run dev:all

# Production build
npm run build
npm start

# Start web only
npm run start:web
```

### Deployment Checklist

- ✅ Database migration
- ✅ Environment variables validation
- ✅ CORS configuration (security)
- ✅ HTTPS enforcement
- ✅ Rate limiting tuning
- ⚠️ Playwright binary size (optional: use Browserless service)
- ⚠️ SQLite → dedicated DB (scaling)
- ⚠️ Logging aggregation (ELK, Datadog, etc.)
- ⚠️ Health checks + monitoring

---

## 12. Kod Kalitesi & Best Practices

### ✅ Strengths
1. **Modular architecture:** Store pattern (pluggable scrapers)
2. **Error handling:** Try-catch blocks, timeout wrapper
3. **Logging:** Comprehensive (pino + morgan)
4. **Type safety:** TypeScript interfaces + Zod validation
5. **Database schema:** Normalized, proper FKs + cascades
6. **Separation of concerns:** Routes ↔ Services ↔ Data access

### ⚠️ Improvements Needed

1. **Error handling:**
   - Some catch blocks are silently swallowing errors (e.g., JSON-LD parse failures)
   - Missing `.catch()` chains in some promises (e.g., notifier)

2. **Code duplication:**
   - Price extraction logic repeated in TrendyolStore, AmazonStore, GenericStore
   - **Suggestion:** Extract common regex patterns to shared utility

3. **Configuration:**
   - Hardcoded selectors/strings (e.g., `"PRODUCT_DETAIL"` in TrendyolStore)
   - **Suggestion:** Move to config file or database

4. **Comments:**
   - Complex variant matching logic needs more inline documentation
   - Store adapters' regex patterns underdocumented

5. **Type definitions:**
   - `any` types used in DB queries (e.g., `as any`)
   - **Suggestion:** Create typed `db.prepare()` wrapper

6. **Async handling:**
   - Some `await` calls missing in notifier service
   - **Suggestion:** Use linter rule `no-floating-promises`

---

## 13. Öneriler ve Sonraki Adımlar

### Short Term (1-2 weeks)
1. Fix CORS & Helmet security headers
2. Add environment variable validation
3. Create proper test suite (unit + integration)
4. Document Telegram & Brevo setup
5. Fix `any` types in DB queries

### Medium Term (1-2 months)
1. Implement concurrent product checking (Promise.all + concurrency limit)
2. Add Playwright for JavaScript-heavy sites (Trendyol variant loading)
3. Create store provider registry (plugin system)
4. Setup CI/CD pipeline (GitHub Actions)
5. Add monitoring & alerting (healthchecks.io, Sentry, etc.)

### Long Term (3+ months)
1. Migrate SQLite → PostgreSQL
2. Implement webhook-based notification system (instead of polling)
3. Add user dashboard analytics (price trends, charts)
4. Multi-tenant architecture improvements
5. API rate limiting per user (token bucket)
6. Caching layer (Redis) for frequently checked products

---

## 14. Sonuç

**Stock Tracker,** solid temel mimariye sahip, ürünü orta ölçekli tarama ve bildirim sistemi. 

**Strengths:**
- Modular, pluggable store pattern
- Comprehensive logging & error handling
- User-friendly UI (Next.js + Tailwind)
- Multi-channel notifications (Telegram, email, in-app)

**Challenges:**
- Security: CORS & Helmet need hardening
- Scaling: SQLite → dedicated DB needed
- Performance: Sequential scraping → parallelization needed
- Testing: Minimal test coverage

**Readiness:** 
- **Development:** ✅ Ready
- **Staging/Testing:** ⚠️ Needs security config + test suite
- **Production:** ⚠️ Needs security, DB migration, monitoring

---

**Generated:** March 18, 2026  
**Version:** 0.1.0 (Development)
