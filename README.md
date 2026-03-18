# 🚀 Stock Tracker

[English](#english) | [Türkçe](#türkçe)

---

<a name="english"></a>
## 🌍 English Version

A professional, full-stack monitoring system designed to track product availability and price fluctuations across multiple e-commerce platforms. Built with **Next.js 14/15**, **TypeScript**, and **Node.js**, featuring real-time notifications via **Telegram** and **Email**.

### ⚖️ Legal Disclaimer & Case Study Note
> [!IMPORTANT]
> **This project is a Technical Case Study developed for educational and portfolio purposes only.** It is designed to demonstrate proficiency in system architecture, web automation, and real-time data processing. 
> - **Not for Commercial Use:** This software is not intended to be used for commercial data scraping or to harm the operations of target e-commerce platforms.
> - **Compliance:** Users are responsible for ensuring compliance with the Terms of Service (ToS) of any website they interact with.
> - **Ethical Scraping:** The system includes rate-limiting and respects standard technical boundaries to minimize server load on target platforms.

### ✨ Key Features (Detailed)
- **🔍 Intelligent Variant-Aware Scraping:** Unlike simple scrapers, **Stock Tracker** identifies specific product variants (e.g., Size: M, Color: Black). It parses **JSON-LD** metadata and global JavaScript state to find the exact stock status of the selected variant.
- **📊 Advanced Price Analytics:** Every check is logged in a time-series database. The dashboard visualizes this data with interactive charts, helping users identify the best time to buy based on historical price floors.
- **🎯 Precision Price Alerts:** Users can set "Price Drop" alarms. The system monitors prices and triggers an instant alert only when the price hits or falls below the user-defined target.
- **🔔 Multi-Channel Alert Engine:** Integrated with **Telegram Bot API** for push notifications and **Brevo/Resend** for professional email alerts. Supports user-level notification preferences.
- **🛡️ Anti-Detection & Fallback:** Uses a multi-layered approach to bypass simple bot detection, including **User-Agent rotation**, **headless browser emulation**, and **Regex-based fallback** for price extraction when structured data is missing.
- **🧱 Modular Store Adapters:** Features a pluggable architecture (`StoreScraper` interface). Adding support for a new e-commerce site is as simple as creating a new class and implementing the `checkProduct` method.

---

<a name="türkçe"></a>
## 🇹🇷 Türkçe Versiyon

Birden fazla e-ticaret platformunda ürün bulunabilirliğini ve fiyat dalgalanmalarını takip etmek için tasarlanmış profesyonel, full-stack bir izleme sistemidir. **Next.js 14/15**, **TypeScript** ve **Node.js** ile geliştirilmiş olup, **Telegram** ve **E-posta** üzerinden gerçek zamanlı bildirimler sunar.

### ⚖️ Hukuki Uyarı ve Vaka Çalışması Notu
> [!IMPORTANT]
> **Bu proje, yalnızca eğitim ve portfolyo amaçlı geliştirilmiş bir Teknik Vaka Çalışmasıdır (Case Study).** Sistem mimarisi, web otomasyonu ve gerçek zamanlı veri işleme yetkinliklerini sergilemek amacıyla tasarlanmıştır.
> - **Ticari Amaç Güdülmez:** Bu yazılım, ticari veri madenciliği yapmak veya hedef platformların işleyişine zarar vermek amacıyla kullanılamaz.
> - **Uyumluluk:** Kullanıcılar, etkileşimde bulundukları web sitelerinin Kullanım Koşullarına (ToS) uymaktan bizzat sorumludur.
> - **Etik Veri Çekme:** Sistem, hedef platformlardaki sunucu yükünü minimize etmek için hız sınırlandırması (rate-limiting) içerir ve teknik sınırlara saygı duyar.

### ✨ Temel Özellikler (Detaylı)
- **🔍 Varyant Duyarlı Akıllı Tarama:** Basit tarayıcıların aksine, **Stock Tracker** ürünün spesifik varyantlarını (Örn: Beden: M, Renk: Siyah) ayırt edebilir. **JSON-LD** meta verilerini ve küresel JavaScript durumlarını analiz ederek seçilen varyantın gerçek stok durumunu bulur.
- **📊 Gelişmiş Fiyat Analitiği:** Her kontrol zaman serisili bir veritabanına kaydedilir. Panel, bu verileri etkileşimli grafiklerle görselleştirerek kullanıcıların geçmiş fiyat diplerine göre en doğru satın alma zamanını belirlemesine yardımcı olur.
- **🎯 Hassas Fiyat Alarmları:** Kullanıcılar "Fiyat Düştü" alarmları kurabilir. Sistem fiyatları izler ve yalnızca fiyat kullanıcının tanımladığı hedefe ulaştığında veya altına düştüğünde anlık uyarı tetikler.
- **🔔 Çok Kanallı Uyarı Motoru:** Push bildirimleri için **Telegram Bot API** ve profesyonel e-posta uyarıları için **Brevo/Resend** ile entegre edilmiştir. Kullanıcı bazlı bildirim tercihlerini destekler.
- **🛡️ Algılama Engelleme ve Yedekleme:** **User-Agent rotasyonu**, **headless browser simülasyonu** ve yapılandırılmış verilerin eksik olduğu durumlarda fiyat çekmek için **Regex tabanlı yedekleme** dahil olmak üzere çok katmanlı bir yaklaşım kullanır.
- **🧱 Modüler Mağaza Adaptörleri:** Tak-çalıştır bir mimariye sahiptir (`StoreScraper` arayüzü). Yeni bir e-ticaret sitesi için destek eklemek, yeni bir sınıf oluşturup `checkProduct` metodunu uygulamak kadar basittir.

---

---

## 🛠️ Tech Stack / Teknolojiler
- **Frontend:** Next.js, Tailwind CSS, Chart.js, Lucide Icons
- **Backend:** Node.js, TypeScript, Playwright, SQLite
- **Integrations:** Brevo, Resend, Telegram Bot API
- **DevOps:** Vercel, Railway, GitHub Actions

## 🚀 Getting Started / Başlangıç
1. `npm install`
2. `cp .env.example .env` (Fill in the keys / Anahtarları doldurun)
3. `npm run dev:all`

---

## 📄 License
This project is licensed under the MIT License.
