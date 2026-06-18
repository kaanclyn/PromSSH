# PromSSH

### Next Generation SSH & Infrastructure Workspace

Version: 1.0 MVP

---

# VISION

PromSSH, klasik SSH istemcilerinin ötesine geçen modern bir masaüstü uygulamasıdır.

Amaç sadece bir sunucuya bağlanmak değildir.

Amaç;

* Sunucuyu analiz etmek,
* Kurulu teknolojileri keşfetmek,
* Projeleri tespit etmek,
* Servisleri yönetmek,
* Dosya sistemini gezmek,
* Logları incelemek,
* Docker ve PM2 süreçlerini görüntülemek,
* Terminal kullanımını minimuma indirerek geliştiricinin işini hızlandırmaktır.

PromSSH kullanıcıya terminal değil, sunucunun kontrol panelini sunmalıdır.

---

# CRITICAL REQUIREMENT

Bu proje web uygulaması değildir.

Bu proje Electron tabanlı gerçek bir masaüstü uygulamasıdır.

Final çıktı aşağıdaki formatlarda olmalıdır:

* PromSSH-Setup.exe
* PromSSH-Portable.exe

Kullanıcı herhangi bir ek yazılım kurmadan uygulamayı kullanabilmelidir.

Final build:

```bash
npm run build
```

komutu ile dağıtıma hazır Windows kurulum paketi oluşturmalıdır.

---

# TARGET USERS

## Yazılım Geliştiriciler

* Node.js geliştiricileri
* React geliştiricileri
* PHP geliştiricileri
* Laravel geliştiricileri
* .NET geliştiricileri
* Java geliştiricileri

## Sistem Uzmanları

* DevOps mühendisleri
* Linux yöneticileri
* Sistem yöneticileri
* Network yöneticileri
* Bulut mühendisleri

## IT Departmanları

* Kurumsal sistem ekipleri
* Veri merkezi ekipleri
* Hosting firmaları

---

# DESIGN GOAL

PromSSH aşağıdaki ürünlerin modern yönlerinden ilham almalıdır:

* VS Code
* Linear
* Raycast
* Notion
* Arc Browser
* Termius

Ama hiçbirinin kopyası olmamalıdır.

Arayüz modern, temiz ve profesyonel olmalıdır.

Kullanıcı ilk açılışta terminal görmek zorunda kalmamalıdır.

---

# CORE PHILOSOPHY

Klasik SSH uygulamaları:

```text
Bağlan
↓
Siyah ekran
↓
Komut yaz
```

PromSSH:

```text
Bağlan
↓
Sunucu Analizi
↓
Dashboard
↓
Servisler
↓
Projeler
↓
Dosyalar
↓
Terminal (gerektiğinde)
```

---

# TECHNOLOGY STACK

## Desktop

* Electron
* React
* TypeScript
* Vite

## UI

* TailwindCSS
* Shadcn UI
* Framer Motion
* Lucide Icons

## Terminal

* xterm.js

## SSH

* ssh2

## Database

* SQLite
* better-sqlite3

## Editor

* Monaco Editor

---

# FIRST SCREEN EXPERIENCE

Kullanıcı uygulamayı açtığında şunları görmelidir:

* Son bağlanılan sunucular
* Favori sunucular
* Son aktiviteler
* Yeni bağlantı oluştur

Modern kart yapısı kullanılmalıdır.

---

# SERVER DASHBOARD

SSH bağlantısı kurulduğu anda PromSSH otomatik analiz başlatmalıdır.

Örnek bilgiler:

* İşletim Sistemi
* Kernel
* Hostname
* Uptime
* CPU
* RAM
* Disk
* Network
* Açık Portlar
* Aktif Servisler
* Docker
* PM2
* Git
* Kurulu Teknolojiler

Dashboard kart yapısında gösterilmelidir.

---

# TECHNOLOGY DETECTOR

PromSSH bağlanılan sunucuda hangi teknolojilerin kurulu olduğunu tespit etmelidir.

Kontrol edilecek sistemler:

* Node.js
* npm
* pnpm
* yarn
* PHP
* Composer
* Python
* Pip
* Java
* Maven
* Gradle
* .NET
* Go
* Rust
* Docker
* Docker Compose
* Redis
* PostgreSQL
* MySQL
* MongoDB
* Git
* Nginx
* Apache
* PM2

Her biri versiyon bilgisi ile gösterilmelidir.

---

# PROJECT DETECTOR

PromSSH proje klasörlerini otomatik keşfetmelidir.

Tespit edilecek projeler:

* Node.js
* Express
* NestJS
* React
* Next.js
* Vue
* Nuxt
* Laravel
* WordPress
* .NET
* Spring Boot
* Django
* Flask

Her proje için:

* Proje adı
* Path
* Framework
* Branch
* Son Commit
* Çalışan Port
* Docker Durumu

gösterilmelidir.

---

# SMART FILE EXPLORER

Klasik SFTP istemcilerinden daha modern olmalıdır.

Özellikler:

* Dosya gezgini
* Sürükle bırak yükleme
* Dosya indirme
* Monaco Editor
* Dosya karşılaştırma
* Favori klasörler

Varsayılan favoriler:

* /var/www
* /etc/nginx
* /etc/systemd
* /var/log
* /home
* /opt

---

# SERVICE CENTER

PromSSH systemd servislerini yönetebilmelidir.

İşlemler:

* Start
* Stop
* Restart
* Enable
* Disable
* Logs

Örnek servisler:

* nginx
* apache
* docker
* redis
* postgresql

---

# DOCKER CENTER

Docker kuruluysa özel dashboard açılmalıdır.

Özellikler:

* Container Listesi
* Image Listesi
* Volume Listesi
* Network Listesi
* Resource Kullanımı
* Logs
* Restart
* Stop

---

# PM2 CENTER

PM2 süreçlerini yönetebilmelidir.

Özellikler:

* Listeleme
* Restart
* Stop
* Delete
* Logs
* Memory Usage
* CPU Usage

---

# PORT CENTER

Aktif portları görsel olarak göstermelidir.

Bilgiler:

* Port
* Process
* PID
* Protocol
* Listening Address

Porta tıklandığında detay ekranı açılmalıdır.

---

# LOG CENTER

Merkezi log yönetimi.

Desteklenecek kaynaklar:

* System Logs
* Nginx Logs
* Docker Logs
* PM2 Logs
* Apache Logs

Özellikler:

* Canlı takip
* Filtreleme
* Arama
* Export

---

# COMMAND CENTER

Kullanıcı sık kullanılan işlemleri butonlarla çalıştırabilmelidir.

Örnek:

* Restart Nginx
* Docker Compose Up
* PM2 Restart All
* Git Pull
* Clear Logs
* Check Disk

Terminal açmak zorunlu olmamalıdır.

---

# TERMINAL

Terminal uygulamanın merkezinde olmayacaktır.

Terminal sadece gerektiğinde kullanılacak yardımcı araçtır.

Özellikler:

* Çoklu sekme
* Split görünüm
* Kopyala/Yapıştır
* Arama
* Komut geçmişi

---

# SECURITY

SSH bilgileri düz metin tutulmamalıdır.

Gereksinimler:

* AES-256 Encryption
* Secure Storage
* SSH Key Support
* Master Password
* Session Lock
* Auto Lock

---

# LOCAL STORAGE

Konum:

```text
%APPDATA%/PromSSH
```

İçerik:

```text
database.db
settings.json
logs/
cache/
```

---

# BUILD SYSTEM

Electron Builder kullanılmalıdır.

Çıktılar:

```text
PromSSH-Setup.exe
PromSSH-Portable.exe
```

Kurulum sonrasında kullanıcı:

```text
Başlat Menüsü
Masaüstü Kısayolu
Uygulama Simgesi
```

oluşturabilmelidir.

---

# MVP FEATURES

İlk sürümde zorunlu özellikler:

* Sunucu Yönetimi
* SSH Bağlantısı
* Dashboard
* Technology Detector
* Project Detector
* Port Viewer
* Service Viewer
* File Explorer
* Monaco Editor
* Terminal
* Light Theme
* Dark Theme
* SQLite Storage

---

# PRODUCT GOAL

PromSSH bir terminal uygulaması gibi hissettirmemelidir.

Kullanıcı uygulamayı açtığında şu hissi yaşamalıdır:

> "Sunucuya SSH ile bağlanmadım.
>
> Sunucunun modern kontrol merkezine giriş yaptım."
