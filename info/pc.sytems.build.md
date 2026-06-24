# Bilgisayar Analizi İçin PowerShell Sorguları ve Ek Araçlar

Bu doküman, bir bilgisayarı analiz etmek için gerekli genel bilgileri, PowerShell ile alınabilecek sorguları ve gerekirse kullanılabilecek ek araçları listeler.

---

## 1. Sistem Kimliği ve Genel Bilgiler

```powershell
hostname
whoami
Get-ComputerInfo
Get-CimInstance Win32_ComputerSystem
Get-CimInstance Win32_OperatingSystem
Get-CimInstance Win32_BIOS
(Get-CimInstance Win32_OperatingSystem).LastBootUpTime
```

Ek araç:

* Yok

---

## 2. İşlemci (CPU)

```powershell
Get-CimInstance Win32_Processor
Get-Counter '\Processor(_Total)\% Processor Time'
```

Ek araç:

* HWiNFO
* OpenHardwareMonitor
* LibreHardwareMonitor

---

## 3. Bellek (RAM)

```powershell
Get-CimInstance Win32_PhysicalMemory
Get-CimInstance Win32_OperatingSystem | Select TotalVisibleMemorySize,FreePhysicalMemory
Get-Counter '\Memory\Available MBytes'
```

Ek araç:

* CPU-Z
* HWiNFO

---

## 4. Anakart / BIOS / TPM

```powershell
Get-CimInstance Win32_BaseBoard
Get-CimInstance Win32_BIOS
Get-Tpm
Confirm-SecureBootUEFI
```

Ek araç:

* CPU-Z
* HWiNFO

---

## 5. Depolama / Disk / Bölümler

```powershell
Get-Disk
Get-PhysicalDisk
Get-Volume
Get-Partition
Get-CimInstance Win32_DiskDrive
Get-CimInstance Win32_LogicalDisk
```

Disk sağlık:

```powershell
Get-PhysicalDisk | Select FriendlyName,HealthStatus,OperationalStatus,Size
Get-StorageReliabilityCounter -PhysicalDisk (Get-PhysicalDisk)
```

Ek araç:

* CrystalDiskInfo
* smartctl
* Hard Disk Sentinel

---

## 6. Ekran Kartı (GPU)

```powershell
Get-CimInstance Win32_VideoController
```

NVIDIA GPU varsa:

```powershell
nvidia-smi
```

Ek araç:

* NVIDIA SMI
* GPU-Z
* HWiNFO

---

## 7. Monitörler

```powershell
Get-CimInstance Win32_DesktopMonitor
Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID
```

Ek araç:

* MonitorInfoView
* HWiNFO

---

## 8. Ağ ve İletişim

```powershell
Get-NetAdapter
Get-NetIPAddress
Get-NetIPConfiguration
Get-DnsClientServerAddress
Get-NetRoute
ipconfig /all
```

Açık portlar:

```powershell
Get-NetTCPConnection -State Listen
netstat -ano
```

Ping / bağlantı testi:

```powershell
Test-Connection 8.8.8.8
Test-NetConnection google.com -Port 443
```

Ek araç:

* Nmap
* Wireshark
* Advanced IP Scanner

---

## 9. Güvenlik

Windows Defender:

```powershell
Get-MpComputerStatus
Get-MpPreference
```

Firewall:

```powershell
Get-NetFirewallProfile
Get-NetFirewallRule
```

BitLocker:

```powershell
Get-BitLockerVolume
```

Kullanıcılar:

```powershell
Get-LocalUser
Get-LocalGroup
Get-LocalGroupMember Administrators
```

Ek araç:

* Microsoft Defender
* Sysinternals Suite
* Windows Security Center

---

## 10. Yazılım Envanteri

Kurulu programlar:

```powershell
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*
Get-ItemProperty HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*
```

Windows sürümü:

```powershell
winver
Get-ComputerInfo | Select WindowsProductName,WindowsVersion,OsBuildNumber
```

Ek araç:

* winget
* Chocolatey

---

## 11. Servisler ve Süreçler

Servisler:

```powershell
Get-Service
Get-CimInstance Win32_Service
```

Süreçler:

```powershell
Get-Process
Get-Process | Sort CPU -Descending | Select -First 10
Get-Process | Sort WorkingSet -Descending | Select -First 10
```

Başlangıç uygulamaları:

```powershell
Get-CimInstance Win32_StartupCommand
```

Ek araç:

* Process Explorer
* Autoruns

---

## 12. Sanallaştırma

Hyper-V:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
Get-VM
```

WSL:

```powershell
wsl --list --verbose
```

Docker:

```powershell
docker version
docker ps
docker images
```

Ek araç:

* Docker Desktop
* VMware
* VirtualBox
* Hyper-V Manager

---

## 13. USB ve Harici Donanımlar

```powershell
Get-PnpDevice
Get-PnpDevice -PresentOnly
Get-CimInstance Win32_USBControllerDevice
Get-CimInstance Win32_SerialPort
Get-Printer
```

Ek araç:

* USBDeview
* Device Manager

---

## 14. Olay Günlükleri

Sistem logları:

```powershell
Get-EventLog -LogName System -Newest 100
Get-WinEvent -LogName System -MaxEvents 100
```

Güvenlik logları:

```powershell
Get-WinEvent -LogName Security -MaxEvents 100
```

Uygulama logları:

```powershell
Get-WinEvent -LogName Application -MaxEvents 100
```

Kritik hatalar:

```powershell
Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2} -MaxEvents 100
```

Ek araç:

* Event Viewer
* Sysmon
* Windows Admin Center

---

## 15. Performans Analizi

CPU:

```powershell
Get-Counter '\Processor(_Total)\% Processor Time'
```

RAM:

```powershell
Get-Counter '\Memory\Available MBytes'
```

Disk:

```powershell
Get-Counter '\PhysicalDisk(_Total)\Disk Reads/sec'
Get-Counter '\PhysicalDisk(_Total)\Disk Writes/sec'
```

Ağ:

```powershell
Get-Counter '\Network Interface(*)\Bytes Total/sec'
```

Ek araç:

* Performance Monitor
* Resource Monitor
* Process Explorer

---

## 16. Donanım Sağlığı

Sıcaklık bilgileri sınırlı alınabilir:

```powershell
Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace "root/wmi"
```

Batarya:

```powershell
powercfg /batteryreport
Get-CimInstance Win32_Battery
```

Ek araç:

* HWiNFO
* OpenHardwareMonitor
* LibreHardwareMonitor
* AIDA64

---

## 17. Kurumsal BT Denetimi

Domain bilgisi:

```powershell
Get-CimInstance Win32_ComputerSystem | Select Domain,PartOfDomain
```

GPO:

```powershell
gpresult /r
gpresult /h report.html
```

Paylaşımlar:

```powershell
Get-SmbShare
Get-SmbSession
```

RDP:

```powershell
Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server'
```

Ek araç:

* RSAT Tools
* Active Directory Users and Computers
* Windows Admin Center

---

## 18. Yazılımcı ve DevOps Analizi

Git:

```powershell
git --version
```

Node.js:

```powershell
node -v
npm -v
```

Python:

```powershell
python --version
pip --version
```

Java:

```powershell
java -version
```

.NET:

```powershell
dotnet --info
```

PHP:

```powershell
php -v
```

IIS:

```powershell
Get-WindowsFeature Web-Server
Get-Website
```

Nginx / Apache:

```powershell
nginx -v
httpd -v
apache -v
```

Veritabanları:

```powershell
Get-Service | Where-Object {$_.Name -match "sql|mysql|postgres|mongo|redis"}
```

Ek araç:

* Docker Desktop
* Git
* VS Code
* Postman
* DBeaver
* pgAdmin
* SQL Server Management Studio

---

## 19. Yapay Zeka ve GPU İş İstasyonu Analizi

CUDA / NVIDIA:

```powershell
nvidia-smi
nvcc --version
```

Ollama:

```powershell
ollama --version
ollama list
```

Python AI kütüphaneleri:

```powershell
pip list | findstr torch
pip list | findstr tensorflow
pip list | findstr onnx
```

Ek araç:

* NVIDIA Driver
* CUDA Toolkit
* cuDNN
* PyTorch
* TensorFlow
* ONNX Runtime
* Ollama
* LM Studio

---

## 20. Sonuç ve Genel Değerlendirme

Bu bölüm PowerShell çıktılarının yorumlanmasıyla oluşturulur.

Analiz başlıkları:

* Genel Sistem Sağlığı
* Güvenlik Skoru
* Performans Skoru
* Donanım Skoru
* Ağ Skoru
* Yazılım Skoru
* Kritik Riskler
* İyileştirme Önerileri
* Kapasite Artırımı Önerileri
* Donanım Yükseltme Önerileri
* Teknik Denetim Özeti

PowerShell çıktıları JSON olarak alınabilir:

```powershell
Get-ComputerInfo | ConvertTo-Json
Get-CimInstance Win32_Processor | ConvertTo-Json
Get-CimInstance Win32_PhysicalMemory | ConvertTo-Json
Get-Disk | ConvertTo-Json
Get-NetAdapter | ConvertTo-Json
Get-Service | ConvertTo-Json
Get-Process | ConvertTo-Json
```

Raporlama için çıktı dosyaya yazılabilir:

```powershell
Get-ComputerInfo | Out-File system-info.txt
Get-ComputerInfo | ConvertTo-Json | Out-File system-info.json
```

Ek araç:

* PowerShell
* JSON Export
* HTML Report
* CSV Export
* PromSSH System Analyzer
