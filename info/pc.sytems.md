# Bilgisayar Analizi ve Sistem Envanteri

Bu doküman, bir bilgisayarı teknik, donanımsal, yazılımsal, güvenlik ve performans açısından analiz etmek için toplanabilecek genel bilgileri listelemektedir.

---

# 1. Sistem Kimliği ve Genel Bilgiler

- Bilgisayar Adı
- Domain / Workgroup
- Üretici
- Model
- Seri Numarası
- Asset Tag
- Kurulum Tarihi
- Son Açılış Tarihi
- Uptime Süresi
- Kullanıcı Adı
- Oturum Açan Kullanıcılar
- İşletim Sistemi
- OS Build Numarası
- Lisans Durumu
- Bölge ve Dil Ayarları
- Saat Dilimi

---

# 2. İşlemci (CPU)

- Model
- Mimari
- Soket Tipi
- Fiziksel Çekirdek Sayısı
- Mantıksal Çekirdek Sayısı
- Temel Frekans
- Turbo Frekans
- L1 Cache
- L2 Cache
- L3 Cache
- Sanallaştırma Desteği
- Hyper-Threading Durumu
- Kullanım Oranı
- Sıcaklık
- Voltaj
- Güç Tüketimi
- Throttling Durumu

---

# 3. Bellek (RAM)

- Toplam RAM
- Kullanılabilir RAM
- Kullanılan RAM
- Boş RAM
- Bellek Türü
- Bellek Frekansı
- Slot Sayısı
- Dolu Slot Sayısı
- Modül Üreticisi
- Modül Seri Numarası
- Part Number
- Kapasite
- Dual/Quad Channel Durumu
- ECC Durumu
- Bellek Kullanım Oranı
- Bellek Hataları

---

# 4. Anakart

- Üretici
- Model
- Seri Numarası
- Chipset
- BIOS Sürümü
- BIOS Tarihi
- UEFI Durumu
- TPM Versiyonu
- Secure Boot Durumu
- PCIe Slotları
- PCIe Cihazları

---

# 5. Depolama

## Disk Bilgileri

- Disk Modeli
- Disk Türü
- Disk Seri Numarası
- Disk Kapasitesi
- Bağlantı Tipi

## Bölümler

- Sürücü Harfi
- Dosya Sistemi
- Toplam Alan
- Kullanılan Alan
- Boş Alan

## Sağlık Bilgileri

- SMART Verileri
- Bad Sector Bilgileri
- Disk Sıcaklığı
- Sağlık Durumu
- TBW
- Çalışma Saati
- Güç Açılma Sayısı

---

# 6. Ekran Kartı (GPU)

- Üretici
- Model
- VRAM
- Driver Sürümü
- CUDA Desteği
- OpenCL Desteği
- DirectX Versiyonu
- Kullanım Oranı
- Sıcaklık
- Güç Tüketimi
- Fan Hızı

---

# 7. Monitörler

- Marka
- Model
- Seri Numarası
- Çözünürlük
- Yenileme Hızı
- Bağlantı Tipi
- HDR Durumu
- Çoklu Monitör Yapısı

---

# 8. Ağ ve İletişim

## Ağ Adaptörleri

- Ethernet Adaptörleri
- Wi-Fi Adaptörleri
- Bluetooth Adaptörleri

## Ağ Bilgileri

- IPv4 Adresleri
- IPv6 Adresleri
- Gateway
- DNS Sunucuları
- DHCP Durumu
- MAC Adresleri

## Ağ Performansı

- Download Hızı
- Upload Hızı
- Ping
- Paket Kaybı
- Aktif Bağlantılar

## Ağ Güvenliği

- Açık Portlar
- Dinleyen Servisler
- Firewall Kuralları
- VPN Bağlantıları

---

# 9. Güvenlik

## Sistem Güvenliği

- Windows Defender
- Antivirüs Durumu
- Firewall Durumu

## Şifreleme

- BitLocker Durumu
- TPM Durumu
- Secure Boot Durumu

## Kullanıcı Güvenliği

- Yerel Kullanıcılar
- Domain Kullanıcıları
- Yönetici Yetkileri
- Son Oturum Açma Kayıtları

## Risk Analizi

- Açık Paylaşımlar
- Riskli Servisler
- Kritik Güvenlik Açıkları
- Zayıf Parola Politikaları

---

# 10. Yazılım Envanteri

## İşletim Sistemi

- Sürüm
- Build
- Lisans Bilgisi

## Kurulu Programlar

- Program Adı
- Sürüm
- Kurulum Tarihi
- Yayıncı

## Çalışan Uygulamalar

- Arka Plan Uygulamaları
- Sistem Servisleri
- Scheduled Tasks

## Geliştirici Araçları

- Node.js
- Python
- Java
- .NET
- PHP
- Docker
- Git
- WSL
- Kubernetes

---

# 11. Servisler ve Süreçler

## Windows Servisleri

- Çalışan Servisler
- Duran Servisler
- Kritik Servisler

## Süreçler

- CPU Kullanımı
- RAM Kullanımı
- Disk Kullanımı
- Ağ Kullanımı

## Başlangıç Programları

- Startup Kayıtları
- Registry Startup
- Scheduled Startup

---

# 12. Sanallaştırma

- Hyper-V
- VMware
- VirtualBox
- Docker
- Kubernetes
- WSL
- Sanal Ağlar
- Sanal Diskler
- Containerlar

---

# 13. USB ve Harici Donanımlar

- USB Cihazları
- COM Portları
- Seri Portlar
- Yazıcılar
- Tarayıcılar
- Akıllı Kart Okuyucular
- Lisans Dongle'ları
- Kameralar
- Mikrofonlar
- Hoparlörler

---

# 14. Olay Günlükleri (Logs)

## Sistem Logları

- Hata Kayıtları
- Uyarılar
- Kritik Olaylar

## Güvenlik Logları

- Başarısız Girişler
- Yetki Yükseltmeleri
- Güvenlik Olayları

## Uygulama Logları

- Çökme Kayıtları
- Uygulama Hataları

---

# 15. Performans Analizi

## CPU

- Ortalama Kullanım
- Maksimum Kullanım

## RAM

- Bellek Baskısı
- Swap Kullanımı

## Disk

- Okuma Hızı
- Yazma Hızı
- IOPS

## Ağ

- Trafik Kullanımı
- En Fazla Trafik Üreten Süreçler

---

# 16. Donanım Sağlığı

- CPU Sıcaklığı
- GPU Sıcaklığı
- Anakart Sıcaklığı
- SSD/HDD Sıcaklığı
- Fan Hızları
- Voltaj Değerleri
- Güç Durumu
- Batarya Sağlığı
- Şarj Döngüsü

---

# 17. Kurumsal BT Denetimi

- Domain Üyeliği
- Active Directory Durumu
- Grup Politikaları (GPO)
- Paylaşılan Klasörler
- Ağ Paylaşımları
- RDP Durumu
- SSH Durumu
- VNC Durumu
- AnyDesk
- TeamViewer
- Yedekleme Sistemleri
- SIEM Entegrasyonları

---

# 18. Yazılımcı ve DevOps Analizi

- Git Kurulumu
- SSH Anahtarları
- Docker Containerları
- Docker Compose Yapıları
- IIS Siteleri
- Apache Yapılandırmaları
- Nginx Yapılandırmaları

## Veritabanları

- MSSQL
- PostgreSQL
- MySQL
- MongoDB
- Redis

## DevOps

- Açık API Portları
- SSL Sertifikaları
- CI/CD Araçları
- PM2 Yapılandırmaları
- Kubernetes Cluster Bilgileri

---

# 19. Yapay Zeka ve GPU İş İstasyonu Analizi

- CUDA Versiyonu
- cuDNN
- Ollama
- LM Studio
- TensorRT
- ROCm

## AI Frameworkleri

- PyTorch
- TensorFlow
- ONNX

## AI Kaynakları

- VRAM Kullanımı
- Model Depolama Alanı
- GPU Benchmark Sonuçları

---

# 20. Sonuç ve Genel Değerlendirme

- Genel Sistem Sağlığı
- Güvenlik Skoru
- Performans Skoru
- Donanım Skoru
- Ağ Skoru
- Yazılım Skoru
- Kritik Riskler
- İyileştirme Önerileri
- Kapasite Artırımı Önerileri
- Donanım Yükseltme Önerileri
- Teknik Denetim Özeti

---

Bu bilgiler; sistem envanteri çıkarmak, performans analizi yapmak, güvenlik denetimi gerçekleştirmek, kurumsal BT denetimi yapmak, donanım yükseltme planlamak ve genel sistem sağlığını değerlendirmek amacıyla kullanılabilir.