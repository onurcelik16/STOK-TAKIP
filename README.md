## Stock Tracker (Node.js + TypeScript + Next.js)

Stok/fiyat takip sistemi: Express API, SQLite, cron job, web panel ve eklenti yapıda scraper.

### Kurulum

```bash
npm install
```

### Geliştirme

**Seçenek 1: Sadece API (port 3000)**
```bash
npm run dev:api
```

**Seçenek 2: Sadece Web Panel (port 3001)**
```bash
npm run dev:web
```

**Seçenek 3: Her İkisi Birlikte (Önerilen)**
```bash
npm run dev:all
```

### Ortam değişkenleri

Bir `.env` dosyası oluşturun:

```
PORT=3000
DB_PATH=./data/app.sqlite
# her 10 dk
CRON=*/10 * * * *
# Browser render için (Trendyol için önerilir)
RENDER_BROWSER=true
```

### API

- `GET /health` – servis kontrol
- `GET /products` – kayıtlı ürünler
- `GET /products/:id` – ürün + son 50 kontrol
- `POST /products` – ürün ekle
  - body: `{ "url": string, "store": string, "selector?": string }`
- `DELETE /products/:id` – siler

`store` için şimdilik `demo` kullanın. `selector` sağlarsanız CSS seçiciye göre stok algılar.

### Örnek istek

```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/product",
    "store": "demo",
    "selector": ".buy-button"
  }'
```

### Web Panel

Tarayıcıda `http://localhost:3001` adresine gidin. Özellikler:
- ✅ Ürün listesi
- ✅ Yeni ürün ekleme formu
- ✅ Ürün detay + geçmiş tablosu
- ✅ Canlı durum göstergesi
- ✅ Kaynak bilgisi (HTTP/Browser)

### Notifier

Şu an sadece konsola yazar. E-posta/Telegram entegrasyonu eklenebilir.



