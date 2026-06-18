# PromSSH - Gelişmiş SSH Sunucu Workspace & Kontrol Paneli

<p align="center">
  <img src="resources/icon.png" width="120" height="120" alt="PromSSH Logo" />
</p>

PromSSH, sistem yöneticileri, backend geliştiricileri ve DevOps mühendisleri için geliştirilmiş, **%100 yerel (local-first)** veri güvenliğine sahip, hepsi bir arada bir sunucu izleme ve yönetim arayüzüdür. 

Uygulama, klasik bir terminal istemcisinin ötesine geçerek sunucunuzdaki Docker konteynerlerini, PM2 süreçlerini, çalışan sistem servislerini, açık portları ve logları görselleştirilmiş dashboard'lar üzerinden yönetmenizi sağlar.

---

## ✨ Öne Çıkan Özellikler

* **🔒 %100 Yerel Veri Güvenliği (AES-256):** Sunucu adresleriniz, şifreleriniz ve özel anahtarlarınız (Private Key PEM) asla harici bulut sunucularına gönderilmez. Tüm hassas veriler cihazınızda yerel bir SQLite veritabanında askeri düzeyde AES-256 standardı ile şifreli olarak saklanır.
* **⚡ Canlı Ping & Gecikme İzleme:** Sunucunuza olan bağlantı gecikme sürelerini (RTT) başlık çubuğu üzerinden anlık olarak milisaniye (ms) bazında takip edin.
* **🔌 Otomatik Yeniden Bağlanma (Keepalive):** SSH bağlantısının kararlı kalması için arka planda otomatik paket gönderimi yapar, kopma durumunda sizi uyarır.
* **📂 FileZilla Tarzı Gelişmiş SFTP Dosya Transferi:** Dosya Gezgini üzerinden sunucuya dosya/klasör yükleme veya indirme işlemlerini yapabilirsiniz. Yapılan işlemler, tıpkı FileZilla'daki gibi asenkron bir kuyrukta, anlık yüzde ve hız göstergeleriyle akar.
* **📦 Docker & PM2 Yönetim Merkezi:** Docker konteynerlerini, imajlarını ve PM2 süreçlerini komut satırına ihtiyaç duymadan tek tıkla başlatabilir, durdurabilir, yeniden başlatabilir veya loglarını inceleyebilirsiniz.
* **🔍 Yerel Akıllı Log Yorumlayıcı:** Sunucunuzdaki sistem veya uygulama loglarını okurken, hata satırlarına tıkladığınızda kural tabanlı yerel yapay zeka/yorumlayıcı motoru sayesinde hatanın nedenini ve olası çözüm komutlarını Türkçe olarak görüntülersiniz.
* **🚀 Hızlı Snippet Deposu:** Sık kullanılan 20'den fazla sistem, Nginx, Docker, PM2 ve Güvenlik komutunu barındıran, tek tıkla kopyalanabilir veya terminalde çalıştırılabilir snippet çekmecesi.
* **🎨 Modern Flat Teal Arayüzü:** Gradyan renkler barındırmayan, gözü yormayan düz ve canlandırılmış modern flat Teal/Mint tasarım dili ile hem açık hem koyu tema desteği.

---

## 🛠️ Kurulum ve Geliştirme

PromSSH, Electron, React, TypeScript ve Vite altyapısı kullanılarak geliştirilmiştir.

### Gereksinimler

* [Node.js](https://nodejs.org/) (v18 veya üzeri tavsiye edilir)
* npm (Node Package Manager)

### Adımlar

1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```

2. **Geliştirme Sunucusunu Başlatın (Hot Reload):**
   ```bash
   npm run dev
   ```

3. **Uygulamayı Önizleyin:**
   ```bash
   npm run start
   ```

4. **Windows için Kurulum Paketlerini Derleyin (NSIS & Portable):**
   ```bash
   npm run build:win
   ```
   Derleme işlemi tamamlandığında, `dist/` klasöründe `PromSSH-Setup.exe` ve `PromSSH-Portable.exe` dosyaları oluşturulacaktır.

---

## 🏢 Geliştirici ve Lisans

Bu uygulama, **[PromSoftware](https://promsoftware.com.tr/)** tarafından sistem mühendislerinin iş akışlarını hızlandırmak üzere tasarlanmıştır.

* **Web Sitesi:** [promsoftware.com.tr](https://promsoftware.com.tr/)
* **Destek & İletişim:** [destek@promsoftware.com.tr](mailto:destek@promsoftware.com.tr)
* **Lisans:** Bireysel ve ticari amaçlarla kullanım tamamen serbesttir (Ticari Lisans Muafiyeti). Yeniden markalandırılarak satılması veya dağıtılması yasaktır.
