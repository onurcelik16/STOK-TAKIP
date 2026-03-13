# Kendi Domain’inden E-posta Gönderme (Brevo)

`noreply@seninsite.com` gibi kendi domain’inden mail göndermek için Brevo’da domain ve gönderici ekleyip doğrulaman gerekir.

---

## 1. Brevo’da Domain Ekleme

1. [app.brevo.com](https://app.brevo.com) → giriş yap.
2. Sol menüden **Senders, Domains & Dedicated IPs** (veya **Göndericiler ve domain’ler**) bölümüne gir.
3. **Domains** sekmesinde **Add a domain** / **Domain ekle** butonuna tıkla.
4. Domain’ini yaz (örn. `seninsite.com` – www veya alt alan olmadan, sadece ana domain).
5. Kaydet.

---

## 2. DNS Kayıtlarını Ekleme (Doğrulama)

Brevo sana birkaç **DNS kaydı** gösterecek. Bunları domain’ini yönettiğin yerde (GoDaddy, Cloudflare, Namecheap, vb.) eklemen gerekiyor.

### Brevo’da göreceğin kayıtlar (örnek)

| Tür | Host / Ad | Değer / Value |
|-----|-----------|----------------|
| **SPF** (TXT) | `@` veya boş | `v=spf1 include:spf.brevo.com ~all` |
| **DKIM** (TXT) | `mail._domainkey` veya Brevo’nun verdiği | Brevo’nun verdiği uzun metin |
| **DMARC** (TXT, opsiyonel) | `_dmarc` | `v=DMARC1; p=none;` |

### Senin yapman gerekenler

1. Domain sağlayıcına gir (örn. Cloudflare, GoDaddy, Namecheap).
2. **DNS / DNS Management / DNS Ayarları** kısmını aç.
3. Brevo’da gördüğün her kayıt için:
   - **Tür:** TXT (SPF ve DKIM için; Brevo’da CNAME derse onu da ekle).
   - **Host/Name:** Brevo’da yazan aynen (örn. `mail._domainkey` veya `@`).
   - **Value/Content:** Brevo’daki değeri aynen yapıştır.
4. Kaydet. DNS yayılımı 5–30 dakika (bazen birkaç saat) sürebilir.

### Brevo’da doğrulama

1. Brevo’da domain sayfasına dön.
2. **Verify** / **Doğrula** butonuna tıkla.
3. Tüm kayıtlar “Verified” / “Doğrulandı” olana kadar bekleyebilir veya birkaç saat sonra tekrar dene.

---

## 3. Gönderici (Sender) Ekleme

1. Brevo’da **Senders, Domains & Dedicated IPs** → **Senders** sekmesi.
2. **Add a sender** / **Gönderici ekle**.
3. Bilgileri doldur:
   - **Email:** `noreply@seninsite.com` (kendi domain’in)
   - **Name:** `Stock Tracker` (veya istediğin isim)
4. Bu adrese Brevo bir doğrulama maili atar. O maildeki linke tıkla ve doğrula.
5. Doğrulandıktan sonra bu adres “Active” / “Aktif” olur.

---

## 4. Projede Ortam Değişkenleri

Railway (veya kullandığın yerde) şunları ayarla:

```env
BREVO_API_KEY=xkeysib-xxxxxxxxxxxx
EMAIL_FROM=noreply@seninsite.com
EMAIL_FROM_NAME=Stock Tracker
```

- `seninsite.com` yerine kendi domain’ini yaz.
- Deploy / restart sonrası mailler bu adresten gidecek; kullanıcılar “Stock Tracker &lt;noreply@seninsite.com&gt;” görür.

---

## Sık Karşılaşılanlar

- **Doğrulama “pending” kalıyor:** DNS’i yeni eklediysen 15–30 dk bekleyip Brevo’da tekrar “Verify” dene. Bazı sağlayıcılarda 24 saate kadar sürebilir.
- **SPF zaten var:** Domain’de başka bir SPF kaydı varsa, mevcut kaydı **silmeden** Brevo’nun verdiği `include:spf.brevo.com` kısmını mevcut SPF’e ekleyebilirsin (tek bir `v=spf1 ... ~all` olmalı, iki ayrı SPF TXT olmamalı).
- **Domain yok:** Henüz domain almadan test için Brevo’nun varsayılan göndericisini veya doğruladığın bir Gmail adresini kullanabilirsin; canlıda kendi domain’ini ekleyip aynı adımları uygularsın.
