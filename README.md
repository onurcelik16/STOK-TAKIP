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

### ✨ Key Features
- **🔍 Intelligent Scraping:** Automated data extraction using **Playwright/Puppeteer** with fallback Regex parsing for high reliability.
- **📈 Price History & Analytics:** Interactive price data visualization using **Chart.js** to track market trends.
- **🔔 Multi-Channel Notifications:** Instant alerts via **Telegram Bot API** and **E-mail (Brevo/Resend)**.
- **🔐 User Management:** Secure authentication with **Email Verification** and user-specific dashboards.
- **📊 Real-time Dashboard:** Modern UI built with **Tailwind CSS**.

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

### ✨ Temel Özellikler
- **🔍 Akıllı Tarama:** Yüksek güvenilirlik için **Playwright/Puppeteer** ve yedek Regex ayrıştırma mekanizması.
- **📈 Fiyat Geçmişi ve Analiz:** Piyasa trendlerini izlemek için **Chart.js** ile etkileşimli veri görselleştirme.
- **🔔 Çok Kanallı Bildirimler:** **Telegram Bot API** ve **E-posta (Brevo/Resend)** üzerinden anlık uyarılar.
- **🔐 Kullanıcı Yönetimi:** **E-posta Doğrulama** ve kullanıcıya özel panellerle güvenli kimlik doğrulama.
- **📊 Gerçek Zamanlı Panel:** **Tailwind CSS** ile oluşturulmuş modern kullanıcı arayüzü.

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
