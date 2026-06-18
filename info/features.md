# PromSSH Advanced Features Roadmap

Bu belge, PromSSH uygulamasını geliştirici dostu, en üst düzey (zirve) bir altyapı yönetim ve izleme paneline dönüştürmek için planlanan gelişmiş özellikleri ve yenilikleri listeler.

---

## 🚀 1. Gelişmiş Bağlantı & Network Çözümleri
*   **Görsel SSH Tünelleme (Port Forwarding):** 
    Sunucu üzerindeki gizli veya yerel portları (örn. 3306 MySQL, 5432 Postgres, 6379 Redis) tek bir tıkla yerel bilgisayarınıza (`localhost:port`) güvenli bir şekilde tünelleyin ve görsel olarak yönetin.
*   **Çoklu SSH Anahtarı Deposu (Key Vault):**
    Bağlantı şifreleri haricinde, PEM formatındaki özel anahtarlarınızı şifreli veritabanımızda güvenle saklayın ve birden fazla sunucu için ortak yetkilendirme olarak atayın.
*   **Ağ Geçidi Sunucu Desteği (Bastion/Jump Host):**
    İç ağda kalan ve doğrudan dışarıya açık olmayan sunucularınıza, bir sıçrama (Jump Host) sunucusu üzerinden otomatik tünel kurarak bağlanın.

---

## 🎨 2. Arayüz & Görsel Deneyim (UX/UI) Geliştirmeleri
*   **Hızlı Komut Paleti (Ctrl+P / Cmd+P):**
    Tüm uygulama genelinde aktif; sunucular arası hızlı geçiş yapabilen, kayıtlı scriptleri tetikleyen veya doğrudan terminal açabilen global akıllı arama çubuğu.
*   **Özelleştirilebilir Tema Motoru (Nord, Dracula, Cyberpunk):**
    Varsayılan premium koyu tema haricinde, kod editörü (Monaco) ve terminal temalarıyla uyumlu çalışan gelişmiş renk paleti şemaları.
*   **Sürükle-Bırak Hızlı SFTP (SFTP Drag-and-Drop):**
    Dosya Gezgini sekmesinde, yerel bilgisayarınızdan sunucudaki herhangi bir klasöre sürükle-bırak yöntemiyle dosya yükleme ve indirme işlemini görsel olarak başlatın.

---

## 🛠️ 3. Akıllı Servis Kontrolörleri & Sihirbazlar
*   **Systemd Servis Sihirbazı (Visual Unit Creator):**
    Komut satırına ihtiyaç duymadan, görsel bir form doldurarak yeni `.service` unit dosyaları oluşturun, bunları sunucuya kaydedin ve aktif edin (örneğin Node/Go backendlerinizi kolayca sistem servisi yapın).
*   **Docker & Docker-Compose Düzenleyici:**
    Sunucudaki `docker-compose.yml` dosyalarını Monaco Editör ile düzenleyin, tek tıkla `up -d`, `down` veya `logs` işlemlerini görsel butonlarla tetikleyin.
*   **PM2 Akıllı Log İzleyici (Realtime Log Streaming):**
    Her PM2 süreci için ayrı ayrı log akışlarını izleyin, filtreleyin ve hata (Error) logları düştüğünde arayüzde bildirim alın.

---

## 📊 4. Sunucu Sağlığı & Akıllı Uyarılar (Monitoring & Alerts)
*   **Kaynak Sınırı Alarmları:**
    Sunucunun CPU kullanımı %90'ı veya RAM kullanımı %95'i geçtiğinde masaüstü bildirimi gönderen veya belirlenen Slack/Discord webhook'una uyarı atan arka plan izleme sistemi.
*   **Port Dinleyicisi ve Değişiklik Bildirimleri:**
    Sunucuda yeni bir port açıldığında veya beklenmedik bir şekilde kapandığında (örn. backend servis çöktüğünde) anlık uyarı alın.
*   **Özel Komut Kütüphanesi (Snippet Vault):**
    Sık kullandığınız komutları (veritabanı yedekleme, önbellek temizleme, güncellemeler) kaydedin ve dashboard üzerinden tek tuşla, parametreler girerek çalıştırın.

---

## 📝 5. Yapılandırma Sürüm Takibi (Config Backup & Diff)
*   **Nginx/Apache Config Revizyon Kontrolü:**
    Nginx veya Apache yapılandırma dosyalarında yaptığınız değişiklikleri kaydetmeden önce eski haliyle karşılaştıran git benzeri bir **Side-by-Side Diff** ekranı.
*   **Otomatik Yedekleme Geçmişi:**
    Düzenlenen kritik yapılandırma dosyalarının (`/etc/...`) otomatik olarak sunucuda veya yerel veritabanında yedeğini alın, hata durumunda tek tuşla eski sürüme geri yükleyin (Rollback).
