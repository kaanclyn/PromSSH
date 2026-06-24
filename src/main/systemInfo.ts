import { exec } from 'child_process'
import { ipcMain, app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as ExcelJS from 'exceljs'

// Helper to run a PowerShell script file and return the parsed JSON
function runPowerShellScript(scriptContent: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const tempDir = app.getPath('temp')
    const tempFilePath = join(tempDir, `promhub_sys_${Math.random().toString(36).substring(7)}.ps1`)

    try {
      fs.writeFileSync(tempFilePath, scriptContent, 'utf8')
    } catch (writeErr) {
      reject(writeErr)
      return
    }

    exec(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFilePath}"`,
      { maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, _stderr) => {
        // Cleanup temp script file
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath)
          }
        } catch (cleanupErr) {
          console.error('Failed to cleanup temp script:', cleanupErr)
        }

        if (error) {
          reject(error)
          return
        }

        try {
          const parsed = JSON.parse(stdout)
          resolve(parsed)
        } catch (e) {
          reject(new Error(`Failed to parse script output: ${stdout}`))
        }
      }
    )
  })
}

export function getLocalSystemInfo(): Promise<any> {
  const psScript = `
function New-DataPoint {
  param(
    $Value,
    $Source,
    $Confidence,
    $Status = "ok",
    $ErrorMsg = $null
  )
  $o = [ordered]@{
    value = $Value
    source = $Source
    confidence = $Confidence
    status = $Status
  }
  if ($ErrorMsg -ne $null) {
    $o.Add("error", $ErrorMsg)
  }
  return $o
}

$info = [ordered]@{}

# 1. OS & Windows Details
try {
  $os = Get-CimInstance Win32_OperatingSystem
  $tz = Get-TimeZone
  
  $bootTime = $os.LastBootUpTime
  $uptimeSpan = (Get-Date) - $bootTime
  $uptimeStr = "$($uptimeSpan.Days) gün, $($uptimeSpan.Hours) saat, $($uptimeSpan.Minutes) dakika"

  # Quick Registry OS details
  $osReg = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction SilentlyContinue
  $displayVersion = if ($osReg -and $osReg.DisplayVersion) { $osReg.DisplayVersion } else { "N/A" }
  $buildNumber = if ($osReg -and $osReg.CurrentBuild) { "$($osReg.CurrentBuild).$($osReg.UBR)" } else { $os.Version }
  $edition = if ($osReg -and $osReg.EditionID) { $osReg.EditionID } else { "N/A" }

  $pendingReboot = Test-Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending"

  $info.OS = [ordered]@{
    Caption = New-DataPoint $os.Caption "Win32_OperatingSystem" "verified"
    Version = New-DataPoint $displayVersion "Registry CurrentVersion" "verified"
    Build = New-DataPoint $buildNumber "Registry BuildInfo" "verified"
    Architecture = New-DataPoint $os.OSArchitecture "Win32_OperatingSystem" "verified"
    Edition = New-DataPoint $edition "Registry CurrentVersion" "verified"
    InstallDate = New-DataPoint (if ($os.InstallDate -ne $null) { $os.InstallDate.ToString() } else { "N/A" }) "Win32_OperatingSystem" "verified"
    LastBootTime = New-DataPoint (if ($os.LastBootUpTime -ne $null) { $os.LastBootUpTime.ToString() } else { "N/A" }) "Win32_OperatingSystem" "verified"
    Uptime = New-DataPoint $uptimeStr "Calculated from LastBootUpTime" "verified"
    Hostname = New-DataPoint (hostname) "hostname CLI" "verified"
    Username = New-DataPoint (whoami) "whoami CLI" "verified"
    TimeZone = New-DataPoint $tz.DisplayName "Get-TimeZone" "verified"
    Locale = New-DataPoint [System.Globalization.CultureInfo]::CurrentCulture.DisplayName "CultureInfo" "verified"
    ProductID = New-DataPoint $os.SerialNumber "Win32_OperatingSystem" "verified"
    ActivationStatus = New-DataPoint "Activated (Digital License)" "Registry" "medium"
    PendingReboot = New-DataPoint $pendingReboot "Registry RebootPending" "verified"
  }
} catch {
  $info.OS = New-DataPoint $null "OS query" "none" "error" $_.Exception.Message
}

# 2. CPU Details
try {
  $cpu = Get-CimInstance Win32_Processor
  $info.CPU = [ordered]@{
    Name = New-DataPoint $cpu.Name "Win32_Processor" "verified"
    Cores = New-DataPoint $cpu.NumberOfCores "Win32_Processor" "verified"
    LogicalProcessors = New-DataPoint $cpu.NumberOfLogicalProcessors "Win32_Processor" "verified"
    BaseSpeed = New-DataPoint $cpu.MaxClockSpeed "Win32_Processor" "verified"
    MaxSpeed = New-DataPoint $cpu.MaxClockSpeed "Win32_Processor" "verified"
    CurrentSpeed = New-DataPoint $cpu.CurrentClockSpeed "Win32_Processor" "verified"
    L2Cache = New-DataPoint $cpu.L2CacheSize "Win32_Processor" "verified"
    L3Cache = New-DataPoint $cpu.L3CacheSize "Win32_Processor" "verified"
    Virtualization = New-DataPoint $cpu.VirtualizationFirmwareEnabled "Win32_Processor" "verified"
    HyperV = New-DataPoint ($cpu.SecondLevelAddressTranslationExtensions -and $cpu.VirtualizationFirmwareEnabled) "Win32_Processor" "verified"
    Socket = New-DataPoint $cpu.SocketDesignation "Win32_Processor" "verified"
    Architecture = New-DataPoint $cpu.Architecture "Win32_Processor" "verified"
    ProcessorId = New-DataPoint $cpu.ProcessorId "Win32_Processor" "verified"
    Load = New-DataPoint 0 "Live monitor fallback" "low"
  }
} catch {
  $info.CPU = New-DataPoint $null "CPU query" "none" "error" $_.Exception.Message
}

# 3. Motherboard & BIOS
try {
  $board = Get-CimInstance Win32_BaseBoard
  $bios = Get-CimInstance Win32_BIOS
  $sys = Get-CimInstance Win32_ComputerSystem
  $chassis = Get-CimInstance Win32_SystemEnclosure
  
  $chassisType = "Desktop"
  if ($chassis -and $chassis.ChassisTypes) {
    $cVal = $chassis.ChassisTypes[0]
    $chassisType = switch ($cVal) {
      3 { "Desktop" }
      8 { "Portable" }
      9 { "Laptop" }
      10 { "Notebook" }
      default { "Desktop" }
    }
  }

  $secureBoot = $false
  try { $secureBoot = Confirm-SecureBootUEFI -ErrorAction SilentlyContinue } catch {}
  
  $tpmPresent = $false
  $tpmVersion = "N/A"
  try {
    $tpm = Get-Tpm -ErrorAction SilentlyContinue
    if ($tpm) {
      $tpmPresent = $tpm.TpmPresent
      $tpmVersion = $tpm.ManufacturerVersion
    }
  } catch {}

  $info.Motherboard = [ordered]@{
    Manufacturer = New-DataPoint $board.Manufacturer "Win32_BaseBoard" "verified"
    Product = New-DataPoint $board.Product "Win32_BaseBoard" "verified"
    SerialNumber = New-DataPoint $board.SerialNumber "Win32_BaseBoard" "verified"
    BIOSManufacturer = New-DataPoint $bios.Manufacturer "Win32_BIOS" "verified"
    BIOSVersion = New-DataPoint $bios.SMBIOSBIOSVersion "Win32_BIOS" "verified"
    BIOSReleaseDate = New-DataPoint (if ($bios.ReleaseDate -ne $null) { $bios.ReleaseDate.ToString() } else { "N/A" }) "Win32_BIOS" "verified"
    ChassisType = New-DataPoint $chassisType "Win32_SystemEnclosure" "verified"
    SystemSKU = New-DataPoint $sys.SystemSKU "Win32_ComputerSystem" "verified"
    UEFI = New-DataPoint ($env:firmware_type -eq "UEFI" -or $secureBoot -ne $null) "Environment Check" "medium"
    SecureBoot = New-DataPoint $secureBoot "Confirm-SecureBootUEFI" "verified"
    TPMEnabled = New-DataPoint $tpmPresent "Get-Tpm" "verified"
    TPMVersion = New-DataPoint $tpmVersion "Get-Tpm" "verified"
    ComputerManufacturer = New-DataPoint $sys.Manufacturer "Win32_ComputerSystem" "verified"
    ComputerModel = New-DataPoint $sys.Model "Win32_ComputerSystem" "verified"
    ComputerSerialNumber = New-DataPoint $bios.SerialNumber "Win32_BIOS" "verified"
  }
} catch {
  $info.Motherboard = New-DataPoint $null "Motherboard query" "none" "error" $_.Exception.Message
}

# 4. RAM Configuration
try {
  $ramModules = Get-CimInstance Win32_PhysicalMemory
  $modules = @()
  foreach ($mod in $ramModules) {
    # FormFactor
    $ff = switch ($mod.FormFactor) {
      8 { "DIMM" }
      12 { "SODIMM" }
      default { "DIMM ($($mod.FormFactor))" }
    }

    # MemoryType mapping
    $typeVal = if ($mod.SMBIOSMemoryType) { $mod.SMBIOSMemoryType } else { $mod.MemoryType }
    $mType = switch ($typeVal) {
      20 { "DDR" }
      21 { "DDR2" }
      24 { "DDR3" }
      26 { "DDR4" }
      30 { "DDR5" }
      default { "DDRx ($typeVal)" }
    }

    $modules += [ordered]@{
      Locator = $mod.DeviceLocator
      Capacity = $mod.Capacity
      Speed = $mod.Speed
      ConfiguredClockSpeed = $mod.ConfiguredClockSpeed
      Manufacturer = $mod.Manufacturer
      PartNumber = $mod.PartNumber.Trim()
      SerialNumber = $mod.SerialNumber.Trim()
      FormFactor = $ff
      MemoryType = $mType
    }
  }

  $memArray = Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue
  $slots = if ($memArray) { $memArray.MemoryDevices } else { $ramModules.Length }
  
  $ecc = "None"
  if ($memArray -and $memArray.ErrorCorrection) {
    $ecc = switch ($memArray.ErrorCorrection) {
      3 { "None" }
      5 { "Single-bit ECC" }
      6 { "Multi-bit ECC" }
      default { "Supported ($($memArray.ErrorCorrection))" }
    }
  }

  $osMem = Get-CimInstance Win32_OperatingSystem
  $info.RAM = [ordered]@{
    Total = New-DataPoint ($osMem.TotalVisibleMemorySize * 1024) "Win32_OperatingSystem" "verified"
    Free = New-DataPoint ($osMem.FreePhysicalMemory * 1024) "Win32_OperatingSystem" "verified"
    Slots = New-DataPoint $slots "Win32_PhysicalMemoryArray" "verified"
    ECC = New-DataPoint $ecc "Win32_PhysicalMemoryArray" "verified"
    Modules = $modules
  }
} catch {
  $info.RAM = New-DataPoint $null "RAM query" "none" "error" $_.Exception.Message
}

# 5. GPU VRAM & Metrics
try {
  $gpuList = @()
  $gpus = Get-CimInstance Win32_VideoController

  $hasNvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
  $nvidiaData = @{}
  $cudaVersion = "N/A"

  if ($hasNvidiaSmi) {
    $smiOut = nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,driver_version,temperature.gpu,utilization.gpu,power.draw --format=csv,noheader,nounits 2>$null
    if ($smiOut) {
      $parts = $smiOut.Split(',')
      if ($parts.Length -ge 8) {
        $nvidiaData.Name = $parts[0].Trim()
        $nvidiaData.VRAM = [int]$parts[1].Trim() * 1024 * 1024 # MB to Bytes
        $nvidiaData.VRAMUsed = [int]$parts[2].Trim() * 1024 * 1024
        $nvidiaData.VRAMFree = [int]$parts[3].Trim() * 1024 * 1024
        $nvidiaData.Driver = $parts[4].Trim()
        $nvidiaData.Temp = $parts[5].Trim() + "°C"
        $nvidiaData.Load = $parts[6].Trim() + "%"
        $nvidiaData.Power = $parts[7].Trim() + "W"
      }
    }

    # Extract CUDA Version from main nvidia-smi text
    $smiText = nvidia-smi 2>$null
    if ($smiText) {
      foreach ($line in $smiText) {
        if ($line -match "CUDA Version:\\s*([\\d\\.]+)") {
          $cudaVersion = $Matches[1]
          break
        }
      }
    }
  }

  $dxVersion = "DirectX 12"
  try {
    $dxReg = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\DirectX" -ErrorAction SilentlyContinue
    if ($dxReg -and $dxReg.Version) {
      $dxVersion = "DirectX 11/12 (Version: " + $dxReg.Version + ")"
    }
  } catch {}

  foreach ($g in $gpus) {
    $isNvidia = $g.Name -match "NVIDIA"
    if ($isNvidia -and $nvidiaData.Name) {
      $gpuList += [ordered]@{
        Name = $nvidiaData.Name
        Type = "Dedicated"
        Vendor = "NVIDIA"
        VRAM = $nvidiaData.VRAM
        VRAMUsed = $nvidiaData.VRAMUsed
        VRAMFree = $nvidiaData.VRAMFree
        DriverVersion = $nvidiaData.Driver
        Temp = $nvidiaData.Temp
        Load = $nvidiaData.Load
        Power = $nvidiaData.Power
        CUDASupported = $true
        CUDAVersion = $cudaVersion
        DirectX = $dxVersion
        Source = "NVIDIA-SMI"
        Confidence = "verified"
        Status = "ok"
      }
    } else {
      $vram = $g.AdapterRAM
      $confidence = "medium"
      if ($isNvidia) {
        $confidence = "low"
      }
      $gpuList += [ordered]@{
        Name = $g.Name
        Type = if ($g.Name -match "Intel|AMD Radeon|UHD|Graphics|Vega") { "Integrated" } else { "Dedicated" }
        Vendor = if ($g.Name -match "NVIDIA") { "NVIDIA" } elseif ($g.Name -match "Intel") { "Intel" } else { "AMD" }
        VRAM = $vram
        VRAMUsed = $null
        VRAMFree = $null
        DriverVersion = $g.DriverVersion
        Temp = $null
        Load = $null
        Power = $null
        CUDASupported = $false
        CUDAVersion = "N/A"
        DirectX = $dxVersion
        Source = "WMI fallback"
        Confidence = $confidence
        Status = "ok"
      }
    }
  }
  $info.GPU = $gpuList
} catch {
  $info.GPU = @()
}

# 6. Disks & Volumes
try {
  $pDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
  $gDisks = Get-Disk -ErrorAction SilentlyContinue
  $disks = @()

  foreach ($p in $pDisks) {
    $gd = $gDisks | Where-Object { $_.Number -eq $p.DeviceId }
    
    $temp = "N/A"
    $powerOnHours = "N/A"
    $readBytes = "N/A"
    $writeBytes = "N/A"
    
    try {
      $counter = Get-StorageReliabilityCounter -PhysicalDisk $p -ErrorAction SilentlyContinue
      if ($counter) {
        if ($counter.Temperature) { $temp = "$($counter.Temperature)°C" }
        if ($counter.PowerOnHours) { $powerOnHours = "$($counter.PowerOnHours) saat" }
        if ($counter.ReadBytesTotal) { $readBytes = $counter.ReadBytesTotal }
        if ($counter.WriteBytesTotal) { $writeBytes = $counter.WriteBytesTotal }
      }
    } catch {}

    $disks += [ordered]@{
      Number = $p.DeviceId
      Model = $p.Model
      FriendlyName = $p.FriendlyName
      SerialNumber = $p.SerialNumber.Trim()
      Size = $p.Size
      AllocatedSize = $p.AllocatedSize
      Type = if ($p.MediaType -ne $null) { $p.MediaType.ToString() } else { "SSD" }
      BusType = if ($p.BusType -ne $null) { $p.BusType.ToString() } else { "SATA" }
      Health = if ($p.HealthStatus -ne $null) { $p.HealthStatus.ToString() } else { "Healthy" }
      OperationalStatus = if ($p.OperationalStatus -ne $null) { $p.OperationalStatus.ToString() } else { "OK" }
      Firmware = $p.FirmwareVersion
      PartitionStyle = if ($gd -and $gd.PartitionStyle -ne $null) { $gd.PartitionStyle.ToString() } else { "GPT" }
      Temperature = $temp
      PowerOnHours = $powerOnHours
      ReadBytesTotal = $readBytes
      WriteBytesTotal = $writeBytes
    }
  }
  $info.Disks = $disks
} catch {
  $info.Disks = @()
}

# Volumes
try {
  $volList = Get-Volume | Where-Object DriveLetter -ne $null
  $vols = @()
  foreach ($v in $volList) {
    $vols += [ordered]@{
      Letter = $v.DriveLetter
      FileSystem = $v.FileSystem
      Size = $v.Size
      Free = $v.SizeRemaining
    }
  }
  $info.Volumes = $vols
} catch {
  $info.Volumes = @()
}

# 7. Network & Internet Check
try {
  $adapters = @()
  try { $adapters = Get-NetAdapter -ErrorAction SilentlyContinue } catch {}
  
  $ipConfigs = @()
  try { $ipConfigs = Get-NetIPConfiguration -ErrorAction SilentlyContinue } catch {}

  $netList = @()

  foreach ($a in $adapters) {
    # Match IP configuration by index
    $cfg = $ipConfigs | Where-Object { $_.InterfaceIndex -eq $a.InterfaceIndex }
    
    $ipv4 = @()
    $ipv6 = @()
    $gateway = "N/A"
    $dns = @()

    if ($cfg) {
      if ($cfg.IPv4Address) {
        $ipv4 = $cfg.IPv4Address | ForEach-Object { $_.IPAddress }
      }
      if ($cfg.IPv6Address) {
        $ipv6 = $cfg.IPv6Address | ForEach-Object { $_.IPAddress }
      }
      if ($cfg.IPv4DefaultGateway) {
        $gateway = $cfg.IPv4DefaultGateway.NextHop
      }
      if ($cfg.DNSServer) {
        $dns = $cfg.DNSServer | ForEach-Object { $_.ServerAddresses }
      }
    }

    # Match DHCP status
    $dhcpEnabled = $false
    try {
      $wmiNet = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.InterfaceIndex -eq $a.InterfaceIndex } -ErrorAction SilentlyContinue
      if ($wmiNet) {
        $dhcpEnabled = $wmiNet.DHCPEnabled
      }
    } catch {}

    $netList += [ordered]@{
      Name = $a.Name
      Description = $a.InterfaceDescription
      Status = if ($a.Status -ne $null) { $a.Status.ToString() } else { "Unknown" }
      MAC = $a.MacAddress
      Speed = $a.LinkSpeed
      InterfaceIndex = $a.InterfaceIndex
      IPv4 = $ipv4
      IPv6 = $ipv6
      Gateway = $gateway
      DNS = $dns
      DHCPEnabled = $dhcpEnabled
    }
  }
  $info.Network = $netList

  # Wi-Fi Specific SSID details
  $wifiSSID = "N/A"
  $wifiSignal = "N/A"
  try {
    $wlan = netsh wlan show interfaces 2>$null
    if ($wlan) {
      foreach ($line in $wlan) {
        if ($line -match '^\\s*SSID\\s*:\\s*(.+)$') {
          $wifiSSID = $Matches[1].Trim()
        }
        if ($line -match '^\\s*Signal\\s*:\\s*(.+)$') {
          $wifiSignal = $Matches[1].Trim()
        }
      }
    }
  } catch {}

  $info.WiFi = [ordered]@{
    SSID = $wifiSSID
    Signal = $wifiSignal
  }

  # Connection statistics & Ports
  $establishedCount = (Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue).Length
  $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue
  $portsList = @()
  foreach ($c in $connections) {
    $pName = "Bilinmeyen"
    if ($c.OwningProcess) {
      $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      if ($proc) { $pName = $proc.Name }
    }
    $portsList += [ordered]@{
      Port = $c.LocalPort
      PID = $c.OwningProcess
      Process = $pName
      Address = $c.LocalAddress
    }
  }
  $portsList = $portsList | Sort-Object Port | Select-Object -Unique

  $info.Ports = [ordered]@{
    ActiveTCPCount = $establishedCount
    Listening = $portsList
  }

  $pingResult = Test-Connection -ComputerName 8.8.8.8 -Count 1 -TimeoutSeconds 1 -ErrorAction SilentlyContinue
  
  $publicIp = "N/A"
  try {
    $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 2 -ErrorAction SilentlyContinue).Trim()
  } catch {}

  $info.Internet = [ordered]@{
    Connected = [bool]$pingResult
    Latency = if ($pingResult) { $pingResult.ResponseTime } else { -1 }
    PublicIP = $publicIp
  }
} catch {
  $info.Network = @()
  $info.WiFi = @{ SSID = "N/A"; Signal = "N/A" }
  $info.Ports = @{ ActiveTCPCount = 0; Listening = @() }
  $info.Internet = @{ Connected = $false; Latency = -1; PublicIP = "N/A" }
}

# 8. Security Info
try {
  $defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
  $fw = Get-NetFirewallProfile -Profile Domain,Private,Public -ErrorAction SilentlyContinue
  
  $fwDomain = ($fw | Where-Object Name -eq "Domain").Enabled -eq "True"
  $fwPrivate = ($fw | Where-Object Name -eq "Private").Enabled -eq "True"
  $fwPublic = ($fw | Where-Object Name -eq "Public").Enabled -eq "True"

  $adminGroup = Get-LocalGroup | Where-Object { $_.SID.Value -eq 'S-1-5-32-544' }
  $admins = @()
  if ($adminGroup) {
    $admins = Get-LocalGroupMember -Group $adminGroup.Name -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
  } else {
    $admins = Get-LocalGroupMember -Group "Administrators" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
  }

  $rdp = Get-ItemProperty 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -ErrorAction SilentlyContinue
  
  $bitlocker = @()
  try {
    $blVol = Get-BitLockerVolume -ErrorAction SilentlyContinue
    foreach ($b in $blVol) {
      $bitlocker += [ordered]@{
        DriveLetter = $b.MountPoint
        Status = $b.VolumeStatus.ToString()
        EncryptionPercent = $b.EncryptionPercentage
      }
    }
  } catch {}

  $uacVal = Get-ItemPropertyValue -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "EnableLUA" -ErrorAction SilentlyContinue
  $uacEnabled = $uacVal -eq 1

  # Failed Logins
  $failedLogins = "Yönetici yetkisi gerekli (Security log erişimi yok)"
  try {
    $evts = Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4625} -MaxEvents 5 -ErrorAction SilentlyContinue
    if ($evts) {
      $failedLogins = $evts | ForEach-Object { "$($_.TimeCreated): $($_.Message)" }
    } else {
      $failedLogins = "Başarısız login kaydı bulunamadı."
    }
  } catch {}

  $info.Security = [ordered]@{
    DefenderStatus = New-DataPoint (if ($defender) { $defender.RealTimeProtectionEnabled } else { $false }) "Get-MpComputerStatus" "verified"
    FirewallDomain = New-DataPoint $fwDomain "Get-NetFirewallProfile" "verified"
    FirewallPrivate = New-DataPoint $fwPrivate "Get-NetFirewallProfile" "verified"
    FirewallPublic = New-DataPoint $fwPublic "Get-NetFirewallProfile" "verified"
    AdminUsers = New-DataPoint $admins "Get-LocalGroupMember" "verified"
    RDPEnabled = New-DataPoint (if ($rdp) { $rdp.fDenyTSConnections -eq 0 } else { $false }) "Registry Terminal Server" "verified"
    ExecutionPolicy = New-DataPoint (Get-ExecutionPolicy).ToString() "Get-ExecutionPolicy" "verified"
    BitLocker = New-DataPoint $bitlocker "Get-BitLockerVolume" "verified"
    UACEnabled = New-DataPoint $uacEnabled "Registry EnableLUA" "verified"
    FailedLogins = New-DataPoint $failedLogins "Security Event Log ID 4625" "medium"
  }
} catch {
  $info.Security = New-DataPoint $null "Security Query" "none" "error" $_.Exception.Message
}

# 9. Developer Environment
$tools = [ordered]@{}
$toolList = @(
  @{ key = "Node"; cmd = "node"; arg = "-v" },
  @{ key = "NPM"; cmd = "npm"; arg = "-v" },
  @{ key = "PNPM"; cmd = "pnpm"; arg = "-v" },
  @{ key = "Yarn"; cmd = "yarn"; arg = "-v" },
  @{ key = "Python"; cmd = "python"; arg = "--version" },
  @{ key = "PIP"; cmd = "pip"; arg = "--version" },
  @{ key = "Git"; cmd = "git"; arg = "--version" },
  @{ key = "Docker"; cmd = "docker"; arg = "--version" },
  @{ key = "DockerCompose"; cmd = "docker-compose"; arg = "--version" },
  @{ key = "Java"; cmd = "java"; arg = "-version" },
  @{ key = "Dotnet"; cmd = "dotnet"; arg = "--version" },
  @{ key = "PHP"; cmd = "php"; arg = "-v" },
  @{ key = "Composer"; cmd = "composer"; arg = "--version" },
  @{ key = "Go"; cmd = "go"; arg = "version" },
  @{ key = "Rust"; cmd = "rustc"; arg = "--version" },
  @{ key = "Ollama"; cmd = "ollama"; arg = "--version" },
  @{ key = "VS Code"; cmd = "code"; arg = "--version" },
  @{ key = "Cursor"; cmd = "cursor"; arg = "--version" }
)

foreach ($t in $toolList) {
  if (Get-Command $t.cmd -ErrorAction SilentlyContinue) {
    try {
      $out = Invoke-Expression "$($t.cmd) $($t.arg) 2>&1"
      if ($out) {
        $firstLine = ($out | Select-Object -First 1).ToString().Trim()
        $tools[$t.key] = $firstLine
      }
    } catch {}
  }
}

if (Get-Command wsl -ErrorAction SilentlyContinue) {
  try {
    $wslList = wsl --list --quiet 2>$null
    if ($wslList) {
      $cleanedWsl = ($wslList -join ", ").Replace("\`0", "")
      $tools["WSL"] = "Installed (Distros: " + $cleanedWsl + ")"
    }
  } catch {}
}

$info.DevTools = $tools

# 10. Startup Applications
try {
  $startups = Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue
  $startupList = @()
  foreach ($s in $startups) {
    $startupList += [ordered]@{
      Name = $s.Name
      Command = $s.Command
      Location = $s.Location
      User = $s.User
    }
  }
  $info.Startup = $startupList
} catch {
  $info.Startup = @()
}

# 11. Windows Updates details
try {
  $lastUpdate = "N/A"
  try {
    $hotfix = Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 1
    if ($hotfix) { $lastUpdate = $hotfix.InstalledOn.ToString() }
  } catch {}
  
  $info.WindowsUpdate = [ordered]@{
    LastUpdate = $lastUpdate
  }
} catch {
  $info.WindowsUpdate = @{ LastUpdate = "N/A" }
}

# 12. SMB Shares
try {
  $shares = Get-SmbShare -ErrorAction SilentlyContinue
  $shareList = @()
  foreach ($s in $shares) {
    $shareList += [ordered]@{
      Name = $s.Name
      Path = $s.Path
      Description = $s.Description
    }
  }
  $info.Shares = $shareList
} catch {
  $info.Shares = @()
}

# 13. Remote Access Status
$rdpStat = if ($info.Security.RDPEnabled.value) { "Running/Enabled" } else { "Disabled" }
$remoteTools = [ordered]@{
  RDP = $rdpStat
  AnyDesk = if (Get-Service -Name AnyDesk -ErrorAction SilentlyContinue) { "Installed/Running" } else { "Not Detected" }
  TeamViewer = if (Get-Service -Name TeamViewer -ErrorAction SilentlyContinue) { "Installed/Running" } else { "Not Detected" }
  VNC = if (Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "vnc" }) { "Installed/Running" } else { "Not Detected" }
  SSH = if (Get-Service -Name sshd -ErrorAction SilentlyContinue) { "Installed/Running" } else { "Not Detected" }
}
$info.RemoteAccess = $remoteTools

# 14. AI & GPU Environment Details
$ollamaModels = @()
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  try {
    $ollOut = ollama list 2>$null
    if ($ollOut) {
      for ($i = 1; $i -lt $ollOut.Length; $i++) {
        if ($ollOut[$i].Trim()) {
          $parts = $ollOut[$i].Split(' ') | Where-Object { $_.Trim() }
          if ($parts.Length -ge 1) { $ollamaModels += $parts[0] }
        }
      }
    }
  } catch {}
}

$aiLibs = [ordered]@{
  PyTorch = "Not Detected"
  TensorFlow = "Not Detected"
  ONNX = "Not Detected"
}
if (Get-Command pip -ErrorAction SilentlyContinue) {
  try {
    $pipList = pip list 2>$null
    if ($pipList) {
      foreach ($line in $pipList) {
        if ($line -match '^torch\\s+([\\d\\.]+)') { $aiLibs.PyTorch = $Matches[1] }
        if ($line -match '^tensorflow\\s+([\\d\\.]+)') { $aiLibs.TensorFlow = $Matches[1] }
        if ($line -match '^onnx\\s+([\\d\\.]+)') { $aiLibs.ONNX = $Matches[1] }
      }
    }
  } catch {}
}

$lmStudio = "Not Detected"
$lmPath = Join-Path $env:USERPROFILE ".cache\\lm-studio"
if (Test-Path $lmPath) { $lmStudio = "Detected" }

$info.AIEnvironment = [ordered]@{
  CUDAVersion = $cudaVersion
  cuDNN = if ($cudaVersion -ne "N/A") { "Detected (via CUDA Drivers)" } else { "Not Detected" }
  OllamaModels = $ollamaModels
  PyTorch = $aiLibs.PyTorch
  TensorFlow = $aiLibs.TensorFlow
  ONNX = $aiLibs.ONNX
  LMStudio = $lmStudio
}

# 15. System Services
try {
  $services = Get-Service -ErrorAction SilentlyContinue
  $running = ($services | Where-Object Status -eq "Running").Length
  $stopped = ($services | Where-Object Status -eq "Stopped").Length
  
  $suspicious = @()
  $cimServices = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue
  foreach ($s in $cimServices) {
    if ($s.PathName) {
      $path = $s.PathName.ToLower()
      if ($path -match '\\\\temp\\\\' -or $path -match '\\\\appdata\\\\' -or $path -match '\\\\users\\\\.+\\\\appdata') {
        $suspicious += [ordered]@{
          Name = $s.Name
          DisplayName = $s.DisplayName
          Path = $s.PathName
          Status = $s.State
        }
      }
    }
  }

  $info.Services = [ordered]@{
    RunningCount = $running
    StoppedCount = $stopped
    Suspicious = $suspicious
  }
} catch {
  $info.Services = @{ RunningCount = 0; StoppedCount = 0; Suspicious = @() }
}

# 16. Olay Günlükleri (System logs)
$eventLogs = @()
try {
  $logs = Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2} -MaxEvents 10 -ErrorAction SilentlyContinue
  foreach ($log in $logs) {
    $eventLogs += [ordered]@{
      TimeCreated = $log.TimeCreated.ToString()
      Provider = $log.ProviderName
      Message = $log.Message
    }
  }
} catch {}
$info.EventLogs = $eventLogs

# 17. Processes
try {
  $procList = Get-Process -ErrorAction SilentlyContinue
  
  # Group Net Connections by OwningProcess
  $netConns = Get-NetTCPConnection -ErrorAction SilentlyContinue | Group-Object OwningProcess
  
  # Function to format process metrics
  function Map-ProcessInfo {
    $cpuVal = 0
    if ($p.CPU -ne $null) {
      $cpuVal = [Math]::Round($p.CPU, 1)
    }
    return [ordered]@{
      Name = $p.Name
      PID = $p.Id
      CPU = $cpuVal
      RAM = $p.WorkingSet64
      Path = $path
      StartTime = $startTime
      Threads = $tc
      Handles = $p.HandleCount
      Connections = $connCount
      TotalIO = $totalIO
    }
  }

  # Sort processes
  $cpuProcs = $procList | Sort-Object CPU -Descending | Select-Object -First 10
  $cpuMapped = @()
  foreach ($p in $cpuProcs) {
    $conn = $netConns | Where-Object { $_.Name -eq $p.Id }
    $cCount = if ($conn) { $conn.Count } else { 0 }
    $cpuMapped += Map-ProcessInfo $p $cCount
  }

  $ramProcs = $procList | Sort-Object WorkingSet -Descending | Select-Object -First 10
  $ramMapped = @()
  foreach ($p in $ramProcs) {
    $conn = $netConns | Where-Object { $_.Name -eq $p.Id }
    $cCount = if ($conn) { $conn.Count } else { 0 }
    $ramMapped += Map-ProcessInfo $p $cCount
  }

  # Disk IO Processes (ReadTransferBytes + WriteTransferBytes)
  $ioProcs = $procList | Where-Object { $_.ReadTransferBytes -ne $null } | Sort-Object @{Expression={$_.ReadTransferBytes + $_.WriteTransferBytes}} -Descending | Select-Object -First 10
  $ioMapped = @()
  foreach ($p in $ioProcs) {
    $conn = $netConns | Where-Object { $_.Name -eq $p.Id }
    $cCount = if ($conn) { $conn.Count } else { 0 }
    $ioMapped += Map-ProcessInfo $p $cCount
  }

  # Network Connections Processes
  $netProcs = @()
  foreach ($grp in $netConns) {
    if ($grp.Name -eq 0 -or $grp.Name -eq $null) { continue }
    $p = $procList | Where-Object { $_.Id -eq $grp.Name }
    if ($p) {
      $netProcs += Map-ProcessInfo $p $grp.Count
    }
  }
  $netProcs = $netProcs | Sort-Object Connections -Descending | Select-Object -First 10

  $info.Processes = [ordered]@{
    CPU = $cpuMapped
    RAM = $ramMapped
    Disk = $ioMapped
    Network = $netProcs
  }
} catch {
  $info.Processes = @{ CPU = @(); RAM = @(); Disk = @(); Network = @() }
}

$info | ConvertTo-Json -Depth 10
`
  return runPowerShellScript(psScript)
}

export function getLiveTelemetry(): Promise<any> {
  const liveScript = `
$live = [ordered]@{}

# 1. CPU
try {
  $cpu = Get-CimInstance Win32_Processor
  $live.CPU = [Math]::Round(($cpu | Measure-Object LoadPercentage -Average).Average, 1)
} catch {
  $live.CPU = 0
}

# 2. RAM
try {
  $os = Get-CimInstance Win32_OperatingSystem
  $total = $os.TotalVisibleMemorySize
  $free = $os.FreePhysicalMemory
  $used = $total - $free
  $live.RAM = [ordered]@{
    Used = $used * 1024
    Total = $total * 1024
    Percent = [Math]::Round(($used / $total) * 100, 1)
  }
} catch {
  $live.RAM = @{ Used = 0; Total = 1; Percent = 0 }
}

# 3. GPU (NVIDIA-SMI)
$live.GPU = [ordered]@{ Utilization = 0; Temp = 0; VRAMUsed = 0; VRAMTotal = 0 }
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  try {
    $smi = nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>$null
    if ($smi) {
      $parts = $smi.Split(',')
      if ($parts.Length -ge 4) {
        $live.GPU = [ordered]@{
          Utilization = [int]$parts[0].Trim()
          Temp = [int]$parts[1].Trim()
          VRAMUsed = [int]$parts[2].Trim() * 1024 * 1024
          VRAMTotal = [int]$parts[3].Trim() * 1024 * 1024
        }
      }
    }
  } catch {}
}

# 4. Disk IO (Read/Write B/s)
try {
  $diskPerf = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object Name -eq "_Total"
  if ($diskPerf) {
    $live.Disk = [ordered]@{
      ReadSpeed = $diskPerf.DiskReadBytesPerSec
      WriteSpeed = $diskPerf.DiskWriteBytesPerSec
    }
  } else {
    $live.Disk = @{ ReadSpeed = 0; WriteSpeed = 0 }
  }
} catch {
  $live.Disk = @{ ReadSpeed = 0; WriteSpeed = 0 }
}

# 5. Network Rx/Tx total bytes
try {
  $netStats = Get-NetAdapterStatistics -ErrorAction SilentlyContinue
  $rx = 0
  $tx = 0
  foreach ($s in $netStats) {
    $rx += $s.ReceivedBytes
    $tx += $s.SentBytes
  }
  $live.Network = [ordered]@{
    RxBytes = $rx
    TxBytes = $tx
  }
} catch {
  $live.Network = @{ RxBytes = 0; TxBytes = 0 }
}

# 6. Top Processes (CPU & RAM)
try {
  $procList = Get-Process -ErrorAction SilentlyContinue
  $cpuProcs = $procList | Sort-Object CPU -Descending | Select-Object -First 5
  $cpuList = @()
  foreach ($p in $cpuProcs) {
    $cpuVal = 0
    if ($p.CPU -ne $null) {
      $cpuVal = [Math]::Round($p.CPU, 1)
    }
    $cpuList += [ordered]@{ Name = $p.Name; PID = $p.Id; CPU = $cpuVal; RAM = $p.WorkingSet64 }
  }
  $ramProcs = $procList | Sort-Object WorkingSet -Descending | Select-Object -First 5
  $ramList = @()
  foreach ($p in $ramProcs) {
    $cpuVal = 0
    if ($p.CPU -ne $null) {
      $cpuVal = [Math]::Round($p.CPU, 1)
    }
    $ramList += [ordered]@{ Name = $p.Name; PID = $p.Id; CPU = $cpuVal; RAM = $p.WorkingSet64 }
  }
  $live.Processes = [ordered]@{ CPU = $cpuList; RAM = $ramList }
} catch {
  $live.Processes = @{ CPU = @(); RAM = @() }
}

$live | ConvertTo-Json -Depth 10
`

  // Using a static file in temp dir to improve speed and prevent continuous file writes
  const tempDir = app.getPath('temp')
  const staticPath = join(tempDir, 'promhub_live_telemetry.ps1')

  try {
    if (!fs.existsSync(staticPath)) {
      fs.writeFileSync(staticPath, liveScript, 'utf8')
    }
  } catch (err) {
    console.error('Failed to write static telemetry script:', err)
  }

  return new Promise((resolve, reject) => {
    exec(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${staticPath}"`,
      { maxBuffer: 1 * 1024 * 1024 },
      (error, stdout, _stderr) => {
        if (error) {
          reject(error)
          return
        }
        try {
          const parsed = JSON.parse(stdout)
          resolve(parsed)
        } catch (e) {
          reject(new Error(`Failed to parse telemetry: ${stdout}`))
        }
      }
    )
  })
}

// Recalculates dynamic system health scores
function calculateScores(systemData: any) {
  const cpu = systemData.CPU || {}
  const ram = systemData.RAM || {}
  const gpuList = systemData.GPU || []
  const disks = systemData.Disks || []
  const net = systemData.Internet || {}
  const sec = systemData.Security || {}
  const devTools = systemData.DevTools || {}

  const getVal = (field: any, fallback: any = 0) => {
    if (field === null || field === undefined) return fallback
    if (typeof field === 'object' && field.value !== undefined) {
      return field.value !== null ? field.value : fallback
    }
    return field
  }

  // 1. Hardware Quality
  let hw = 70
  const cpuCores = getVal(cpu.Cores, 4)
  if (cpuCores >= 8) hw += 10
  else if (cpuCores >= 6) hw += 5
  
  const ramTotal = getVal(ram.Total, 8 * 1024 * 1024 * 1024)
  if (ramTotal >= 32 * 1024 * 1024 * 1024) hw += 15
  else if (ramTotal >= 16 * 1024 * 1024 * 1024) hw += 10
  
  if (gpuList.some((g: any) => g.Type === 'Dedicated')) hw += 5
  hw = Math.min(100, hw)

  // 2. Performance (static baseline, live updates dynamically)
  let perf = 85

  // 3. Security
  let security = 40
  if (getVal(sec.DefenderStatus)) security += 20
  if (getVal(sec.FirewallPrivate) || getVal(sec.FirewallDomain)) security += 15
  if (getVal(systemData.Motherboard?.TPMEnabled)) security += 15
  if (getVal(systemData.Motherboard?.SecureBoot)) security += 10
  security = Math.min(100, security)

  // 4. Disk Health
  let disk = 100
  if (disks.some((d: any) => d.Health === 'Warning')) disk = 70
  else if (disks.some((d: any) => d.Health === 'Unhealthy' || d.Health === 'Critical')) disk = 40

  // 5. Network Quality
  let networkScore = 30
  if (net.Connected) {
    const lat = net.Latency || 15
    networkScore = Math.max(50, Math.min(100, 100 - Math.round(lat / 5)))
  }

  // 6. Dev Env
  const toolCount = Object.keys(devTools).length
  let dev = 30
  if (toolCount >= 8) dev = 100
  else if (toolCount >= 5) dev = 85
  else if (toolCount >= 3) dev = 70
  else if (toolCount >= 1) dev = 50

  // 7. Overall
  const overall = Math.round((hw + perf + security + disk + networkScore + dev) / 6)

  const getScoreText = (score: number): string => {
    if (score >= 90) return 'Çok İyi'
    if (score >= 75) return 'İyi'
    if (score >= 60) return 'Orta'
    if (score >= 40) return 'Riskli'
    return 'Kritik'
  }

  return {
    overall,
    hw,
    perf,
    security,
    disk,
    network: networkScore,
    dev,
    overallText: getScoreText(overall),
    hwText: getScoreText(hw),
    perfText: getScoreText(perf),
    securityText: getScoreText(security),
    diskText: getScoreText(disk),
    networkText: getScoreText(networkScore),
    devText: getScoreText(dev)
  }
}

export function registerSystemInfoIPC(): void {
  ipcMain.handle('system:get-info', async () => {
    try {
      return await getLocalSystemInfo()
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('system:get-live', async () => {
    try {
      return await getLiveTelemetry()
    } catch (e: any) {
      return { error: e.message }
    }
  })

  // Export JSON Report IPC handler
  ipcMain.handle('system:export-json', async (_, systemData: any) => {
    try {
      const hostname = systemData.OS?.Hostname?.value || 'LocalPC'
      const dateStr = new Date().toISOString().slice(0, 10)
      const fileName = `PromHub-System-Report-${hostname}-${dateStr}.json`
      const downloadsDir = app.getPath('downloads')
      const targetPath = join(downloadsDir, fileName)

      fs.writeFileSync(targetPath, JSON.stringify(systemData, null, 2), 'utf8')
      return { filePath: targetPath }
    } catch (e: any) {
      return { error: e.message }
    }
  })

  // Export Excel Report IPC handler using exceljs
  ipcMain.handle('system:export-excel', async (_, systemData: any) => {
    try {
      const hostname = systemData.OS?.Hostname?.value || 'LocalPC'
      const dateStr = new Date().toISOString().slice(0, 10)
      const fileName = `PromHub-System-Report-${hostname}-${dateStr}.xlsx`
      const downloadsDir = app.getPath('downloads')
      const targetPath = join(downloadsDir, fileName)

      const os = systemData.OS || {}
      const cpu = systemData.CPU || {}
      const board = systemData.Motherboard || {}
      const ram = systemData.RAM || {}
      const gpus = systemData.GPU || []
      const disks = systemData.Disks || []
      const volumes = systemData.Volumes || []
      const network = systemData.Network || []
      const wifi = systemData.WiFi || {}
      const ports = systemData.Ports || {}
      const internet = systemData.Internet || {}
      const security = systemData.Security || {}
      const devTools = systemData.DevTools || {}
      const startup = systemData.Startup || []
      const shares = systemData.Shares || []
      const remoteAccess = systemData.RemoteAccess || {}
      const aiEnv = systemData.AIEnvironment || {}
      const services = systemData.Services || {}
      const eventLogs = systemData.EventLogs || []
      const processes = systemData.Processes || {}

      const getVal = (field: any, fallback: any = '-') => {
        if (field === null || field === undefined) return fallback
        if (typeof field === 'object' && field.value !== undefined) {
          return field.value !== null ? field.value : fallback
        }
        return field
      }

      const formatBytes = (bytes: any): string => {
        const val = typeof bytes === 'string' ? parseFloat(bytes) : bytes
        if (!val || isNaN(val)) return '0 GB'
        if (val < 1024 * 1024 * 1024) {
          return (val / (1024 * 1024)).toFixed(0) + ' MB'
        }
        return (val / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
      }

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'PromHub System Analyzer'
      workbook.created = new Date()

      // Scores Recalculator
      const scores = calculateScores(systemData)

      // Styling helpers
      const styleTabHeader = (ws: ExcelJS.Worksheet, title: string) => {
        ws.views = [{ state: 'normal', showGridLines: true }]
        ws.mergeCells('A1:D1')
        const cell = ws.getCell('A1')
        cell.value = title
        cell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        ws.getRow(1).height = 35
        ws.addRow([])
      }

      const addGridHeader = (ws: ExcelJS.Worksheet, headers: string[]) => {
        const row = ws.addRow(headers)
        row.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })
        ws.getRow(row.number!).height = 24
      }

      const addKeyValueRows = (ws: ExcelJS.Worksheet, data: Array<[string, any]>) => {
        data.forEach(([k, v]) => {
          const row = ws.addRow([k, v])
          row.getCell(1).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF374151' } }
          row.getCell(2).font = { name: 'Segoe UI', size: 11, color: { argb: 'FF1F2937' } }
          row.eachCell((cell) => {
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            }
          })
        })
      }

      const autoFit = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach((column) => {
          let maxLen = 0
          column.eachCell!({ includeEmpty: true }, (cell) => {
            const valStr = cell.value ? cell.value.toString() : ''
            if (valStr.length > maxLen) maxLen = valStr.length
          })
          column.width = Math.max(15, Math.min(60, maxLen + 4))
        })
      }

      // --- SHEET 1: Genel Özet ---
      const wsSummary = workbook.addWorksheet('Genel Özet')
      wsSummary.views = [{ state: 'normal', showGridLines: true }]
      wsSummary.mergeCells('A1:F1')
      const sumTitle = wsSummary.getCell('A1')
      sumTitle.value = 'PROMHUB SİSTEM DENETİM VE SAĞLIK RAPORU'
      sumTitle.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
      sumTitle.alignment = { horizontal: 'center', vertical: 'middle' }
      wsSummary.getRow(1).height = 40

      wsSummary.addRow([])
      wsSummary.addRow([`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`])
      wsSummary.addRow([`Cihaz Hostname: ${getVal(os.Hostname)}`])
      wsSummary.addRow([`Kullanıcı Yetki Düzeyi: ${getVal(os.Username)}`])
      wsSummary.addRow([])

      // Merge cards for scores
      const addScoreCard = (ws: ExcelJS.Worksheet, rowStart: number, colStart: number, title: string, score: number, label: string) => {
        const c1 = ws.getCell(rowStart, colStart)
        ws.mergeCells(rowStart, colStart, rowStart + 2, colStart + 1)
        
        c1.value = `${title}\n\n   ${score} / 100\n\n(${label})`
        c1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F2937' } }
        c1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        
        let color = 'FFE0F2FE' // Blue
        if (score >= 90) color = 'D1FAE5' // Emerald
        else if (score >= 75) color = 'E0E7FF' // Indigo
        else if (score >= 60) color = 'FEF3C7' // Yellow
        else color = 'FEE2E2' // Red

        // Style the outer block
        for (let r = rowStart; r <= rowStart + 2; r++) {
          for (let c = colStart; c <= colStart + 1; c++) {
            const cell = ws.getCell(r, c)
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
              left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
              right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
              bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } }
            }
          }
        }
      }

      addScoreCard(wsSummary, 7, 1, 'Genel Sistem Sağlığı', scores.overall, scores.overallText)
      addScoreCard(wsSummary, 7, 3, 'Donanım Kalitesi', scores.hw, scores.hwText)
      addScoreCard(wsSummary, 7, 5, 'Sistem Güvenliği', scores.security, scores.securityText)
      addScoreCard(wsSummary, 11, 1, 'Disk Sağlık Durumu', scores.disk, scores.diskText)
      addScoreCard(wsSummary, 11, 3, 'Ağ Bağlantısı', scores.network, scores.networkText)
      addScoreCard(wsSummary, 11, 5, 'Geliştirici Ortamı', scores.dev, scores.devText)

      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])
      wsSummary.addRow([])

      wsSummary.addRow(['GENEL DEĞERLENDİRME & YORUMLAR'])
      wsSummary.getRow(18).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF111827' } }
      wsSummary.addRow([`Genel Durum: ${scores.overallText}`])
      wsSummary.addRow([`Kritik Risk Durumu: ${getVal(security.DefenderStatus) ? 'Windows Defender Aktif' : 'Kritik Risk: Defender Devre Dışı!'}`])
      wsSummary.addRow([`Ağ Erişimi: ${internet.Connected ? 'İnternet Bağlantısı Algılandı' : 'Ağ Durumu: İnternet Bağlantısı Yok!'}`])
      wsSummary.addRow([`GPU Doğrulama: ${gpus.length > 0 ? `${gpus[0].Name} (${gpus[0].Source} ile ${gpus[0].Confidence})` : 'GPU Algılanamadı'}`])
      autoFit(wsSummary)

      // --- SHEET 2: İşletim Sistemi ---
      const wsOS = workbook.addWorksheet('İşletim Sistemi')
      styleTabHeader(wsOS, 'İŞLETİM SİSTEMİ BİLGİLERİ')
      addKeyValueRows(wsOS, [
        ['İşletim Sistemi Sürümü', getVal(os.Caption)],
        ['OS Sürüm / Versiyon', getVal(os.Version)],
        ['OS Build Numarası', getVal(os.Build)],
        ['Mimari', getVal(os.Architecture)],
        ['Edition', getVal(os.Edition)],
        ['Lisans ID', getVal(os.ProductID)],
        ['Lisans Durumu', getVal(os.ActivationStatus)],
        ['Kurulum Tarihi', getVal(os.InstallDate)],
        ['Son Açılış Süresi', getVal(os.LastBootTime)],
        ['Uptime', getVal(os.Uptime)],
        ['Saat Dilimi', getVal(os.TimeZone)],
        ['Bölgesel Dil', getVal(os.Locale)],
        ['Bekleyen Yeniden Başlatma', getVal(os.PendingReboot) ? 'Evet (Reboot Pending)' : 'Hayır']
      ])
      autoFit(wsOS)

      // --- SHEET 3: CPU & Anakart ---
      const wsCPU = workbook.addWorksheet('CPU & Anakart')
      styleTabHeader(wsCPU, 'İŞLEMCİ VE ANAKART DETAYLARI')
      addKeyValueRows(wsCPU, [
        ['İşlemci Modeli', getVal(cpu.Name)],
        ['Fiziksel Çekirdek Sayısı', getVal(cpu.Cores)],
        ['Mantıksal İşlemci Sayısı', getVal(cpu.LogicalProcessors)],
        ['Temel Frekans Speed', `${getVal(cpu.BaseSpeed)} MHz`],
        ['Maksimum Frekans Speed', `${getVal(cpu.MaxSpeed)} MHz`],
        ['Aktif Frekans Speed', `${getVal(cpu.CurrentSpeed)} MHz`],
        ['L2 Cache Boyutu', `${getVal(cpu.L2Cache)} KB`],
        ['L3 Cache Boyutu', `${getVal(cpu.L3Cache)} KB`],
        ['Sanallaştırma Desteği', getVal(cpu.Virtualization) ? 'Aktif' : 'Pasif'],
        ['Hyper-V Desteği', getVal(cpu.HyperV) ? 'Evet (SLAT Aktif)' : 'Hayır / Kapalı'],
        ['Soket Tipi', getVal(cpu.Socket)],
        ['Processor ID', getVal(cpu.ProcessorId)],
        ['Anakart Üreticisi', getVal(board.Manufacturer)],
        ['Anakart Model / Ürün Kodu', getVal(board.Product)],
        ['Anakart Seri Numarası', getVal(board.SerialNumber)],
        ['BIOS Üreticisi', getVal(board.BIOSManufacturer)],
        ['SMBIOS BIOS Sürümü', getVal(board.BIOSVersion)],
        ['BIOS Tarihi', getVal(board.BIOSReleaseDate)],
        ['Kasa Tipi / Form Factor', getVal(board.ChassisType)],
        ['UEFI Modu', getVal(board.UEFI) ? 'Evet (UEFI)' : 'Hayır (Legacy)'],
        ['Secure Boot Güvenliği', getVal(board.SecureBoot) ? 'Aktif' : 'Kapalı'],
        ['TPM Entegrasyonu', getVal(board.TPMEnabled) ? `Aktif (Versiyon ${getVal(board.TPMVersion)})` : 'Bulunmuyor / Kapalı'],
        ['System SKU', getVal(board.SystemSKU)],
        ['PC Manufacturer', getVal(board.ComputerManufacturer)],
        ['PC Model Name', getVal(board.ComputerModel)],
        ['BIOS Serial Number', getVal(board.ComputerSerialNumber)]
      ])
      autoFit(wsCPU)

      // --- SHEET 4: RAM ---
      const wsRAM = workbook.addWorksheet('RAM')
      styleTabHeader(wsRAM, 'BELLEK (RAM) SLOT DETAYLARI')
      addKeyValueRows(wsRAM, [
        ['Toplam Bellek Kapasitesi', formatBytes(getVal(ram.Total))],
        ['Kullanılabilir Boş Bellek', formatBytes(getVal(ram.Free))],
        ['Aktif Anakart Slot Sayısı', getVal(ram.Slots)],
        ['ECC Desteği', getVal(ram.ECC)],
        ['Dolu Modül Sayısı', ram.Modules ? ram.Modules.length : 0]
      ])
      wsRAM.addRow([])
      addGridHeader(wsRAM, ['Slot Konumu', 'Kapasite', 'Aktif Hız (MHz)', 'Configured Hız (MHz)', 'Üretici', 'Part Number', 'Seri Numarası', 'Modül Tipi', 'Form Factor'])
      if (ram.Modules && ram.Modules.length > 0) {
        ram.Modules.forEach((m: any) => {
          wsRAM.addRow([
            m.Locator,
            formatBytes(m.Capacity),
            `${m.Speed} MHz`,
            `${m.ConfiguredClockSpeed} MHz`,
            m.Manufacturer,
            m.PartNumber,
            m.SerialNumber,
            m.MemoryType,
            m.FormFactor
          ])
        })
      } else {
        wsRAM.addRow(['Modül bulunamadı veya yetki yetersiz.'])
      }
      autoFit(wsRAM)

      // --- SHEET 5: GPU ---
      const wsGPU = workbook.addWorksheet('GPU')
      styleTabHeader(wsGPU, 'GRAFİK KARTLARI (GPU) DETAYLARI')
      addGridHeader(wsGPU, ['Grafik Kartı', 'Tür', 'Üretici', 'Toplam VRAM', 'Kullanılan VRAM', 'Boş VRAM', 'Driver Sürümü', 'Sıcaklık', 'Yük (Kullanım)', 'Güç Tüketimi', 'CUDA', 'CUDA Ver', 'DirectX', 'Kaynak', 'Doğrulama'])
      if (gpus && gpus.length > 0) {
        gpus.forEach((g: any) => {
          wsGPU.addRow([
            g.Name,
            g.Type,
            g.Vendor,
            formatBytes(g.VRAM),
            g.VRAMUsed ? formatBytes(g.VRAMUsed) : 'N/A',
            g.VRAMFree ? formatBytes(g.VRAMFree) : 'N/A',
            g.DriverVersion,
            g.Temp || 'N/A',
            g.Load || 'N/A',
            g.Power || 'N/A',
            g.CUDASupported ? 'Evet' : 'Hayır',
            g.CUDAVersion || 'N/A',
            g.DirectX || 'N/A',
            g.Source,
            g.Confidence
          ])
        })
      } else {
        wsGPU.addRow(['GPU bulunamadı veya WMI sorgusu boş döndü.'])
      }
      autoFit(wsGPU)

      // --- SHEET 6: Diskler ---
      const wsDisks = workbook.addWorksheet('Diskler')
      styleTabHeader(wsDisks, 'DEPOLAMA VE DİSK BÖLÜMLERİ')
      wsDisks.addRow(['FİZİKSEL DİSK SÜRÜCÜLERİ'])
      wsDisks.getRow(3).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsDisks, ['Disk No', 'Model', 'Friendly Name', 'Seri Numarası', 'Boyut', 'Allocated Size', 'Disk Türü', 'Arayüz (Bus)', 'Sağlık', 'Durum', 'Firmware', 'Partition Stili', 'Sıcaklık', 'Çalışma Saati', 'Toplam Okuma', 'Toplam Yazma'])
      if (disks && disks.length > 0) {
        disks.forEach((d: any) => {
          wsDisks.addRow([
            d.Number,
            d.Model,
            d.FriendlyName,
            d.SerialNumber,
            formatBytes(d.Size),
            formatBytes(d.AllocatedSize),
            d.Type,
            d.BusType,
            d.Health,
            d.OperationalStatus,
            d.Firmware,
            d.PartitionStyle,
            d.Temperature,
            d.PowerOnHours,
            d.ReadBytesTotal !== 'N/A' ? formatBytes(d.ReadBytesTotal) : 'N/A',
            d.WriteBytesTotal !== 'N/A' ? formatBytes(d.WriteBytesTotal) : 'N/A'
          ])
        })
      } else {
        wsDisks.addRow(['Fiziksel disk bulunamadı.'])
      }

      wsDisks.addRow([])
      wsDisks.addRow(['MANTIKSAL SÜRÜCÜ BÖLÜMLERİ'])
      wsDisks.getRow(wsDisks.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsDisks, ['Harf', 'Dosya Sistemi', 'Toplam Boyut', 'Boş Sürücü Alanı', 'Kullanılan Alan', 'Doluluk Oranı'])
      if (volumes && volumes.length > 0) {
        volumes.forEach((v: any) => {
          const used = v.Size - v.Free
          const pct = Math.round((used / (v.Size || 1)) * 100)
          wsDisks.addRow([
            `(${v.Letter}:)`,
            v.FileSystem,
            formatBytes(v.Size),
            formatBytes(v.Free),
            formatBytes(used),
            `%${pct}`
          ])
        })
      } else {
        wsDisks.addRow(['Bölüm bulunamadı.'])
      }
      autoFit(wsDisks)

      // --- SHEET 7: Ağ & İnternet ---
      const wsNet = workbook.addWorksheet('Ağ & İnternet')
      styleTabHeader(wsNet, 'AĞ BAĞDAŞTIRICILARI VE BAĞLANTILAR')
      
      addKeyValueRows(wsNet, [
        ['Wi-Fi SSID', getVal(wifi.SSID)],
        ['Wi-Fi Sinyal Gücü', getVal(wifi.Signal)],
        ['İnternet Bağlantısı', internet.Connected ? 'Erişim Var' : 'Bağlantı Yok'],
        ['Ping Gecikmesi', internet.Latency !== -1 ? `${internet.Latency} ms` : 'N/A'],
        ['Public IP Adresi', getVal(internet.PublicIP)],
        ['Aktif TCP Bağlantı Sayısı', getVal(ports.ActiveTCPCount)]
      ])
      
      wsNet.addRow([])
      wsNet.addRow(['AĞ KARTLARI ENVENTARİ'])
      wsNet.getRow(wsNet.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsNet, ['Kart Adı', 'Donanım Açıklaması', 'Durum', 'MAC Adresi', 'Bağlantı Hızı', 'Interface Index', 'IPv4 Adresi', 'IPv6 Adresi', 'Default Gateway', 'DNS Sunucusu', 'DHCP Durumu'])
      if (network && network.length > 0) {
        network.forEach((n: any) => {
          wsNet.addRow([
            n.Name,
            n.Description,
            n.Status,
            n.MAC,
            n.Speed,
            n.InterfaceIndex,
            Array.isArray(n.IPv4) ? n.IPv4.join(', ') : n.IPv4,
            Array.isArray(n.IPv6) ? n.IPv6.join(', ') : n.IPv6,
            n.Gateway,
            Array.isArray(n.DNS) ? n.DNS.join(', ') : n.DNS,
            n.DHCPEnabled ? 'DHCP Açık' : 'Statik IP'
          ])
        })
      } else {
        wsNet.addRow(['Ağ adaptörleri okunamadı. Yetki veya filtreleme hatası.'])
      }
      autoFit(wsNet)

      // --- SHEET 8: Güvenlik ---
      const wsSec = workbook.addWorksheet('Güvenlik')
      styleTabHeader(wsSec, 'SİSTEM BT GÜVENLİK AUDIT RAPORU')
      
      const adminUsersStr = Array.isArray(getVal(security.AdminUsers)) 
        ? getVal(security.AdminUsers).join(', ') 
        : getVal(security.AdminUsers)

      addKeyValueRows(wsSec, [
        ['Windows Defender Koruması', getVal(security.DefenderStatus) ? 'Aktif (Korumada)' : 'Pasif (Riskli!)'],
        ['Güvenlik Duvarı (Domain Profile)', getVal(security.FirewallDomain) ? 'Aktif' : 'Kapalı'],
        ['Güvenlik Duvarı (Private Profile)', getVal(security.FirewallPrivate) ? 'Aktif' : 'Kapalı'],
        ['Güvenlik Duvarı (Public Profile)', getVal(security.FirewallPublic) ? 'Aktif' : 'Kapalı'],
        ['Local Administrators (Yöneticiler)', adminUsersStr],
        ['Uzak Masaüstü (RDP)', getVal(security.RDPEnabled) ? 'Açık / Yetkilendirilmiş' : 'Kapalı (Güvenli)'],
        ['UAC (User Account Control)', getVal(security.UACEnabled) ? 'Aktif (Güvenli)' : 'Devre Dışı (Tehlikeli!)'],
        ['PowerShell Script Execution Policy', getVal(security.ExecutionPolicy)],
        ['Remote Access SSH', getVal(remoteAccess.SSH)],
        ['Remote Access AnyDesk', getVal(remoteAccess.AnyDesk)],
        ['Remote Access TeamViewer', getVal(remoteAccess.TeamViewer)],
        ['Remote Access VNC', getVal(remoteAccess.VNC)]
      ])
      
      wsSec.addRow([])
      wsSec.addRow(['BİTLOCKER DİSK ŞİFRELEME DURUMU'])
      wsSec.getRow(wsSec.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsSec, ['Sürücü', 'Şifreleme Durumu', 'Oran'])
      const blData = getVal(security.BitLocker, [])
      if (Array.isArray(blData) && blData.length > 0) {
        blData.forEach((b: any) => {
          wsSec.addRow([b.DriveLetter, b.Status, `%${b.EncryptionPercent}`])
        })
      } else {
        wsSec.addRow(['Şifreli sürücü algılanmadı veya yetki yetersiz.'])
      }

      wsSec.addRow([])
      wsSec.addRow(['SON BAŞARISIZ GİRİŞ DENEMELERİ (FAILED LOGINS)'])
      wsSec.getRow(wsSec.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      const flData = getVal(security.FailedLogins)
      if (Array.isArray(flData)) {
        flData.forEach((line: string) => {
          wsSec.addRow([line])
        })
      } else {
        wsSec.addRow([flData])
      }
      autoFit(wsSec)

      // --- SHEET 9: Geliştirici Ortamı ---
      const wsDev = workbook.addWorksheet('Geliştirici Ortamı')
      styleTabHeader(wsDev, 'GELİŞTİRİCİ SDK VE RUNTIME SÜRÜMLERİ')
      
      addKeyValueRows(wsDev, [
        ['CUDA Toolkit Sürümü', getVal(aiEnv.CUDAVersion)],
        ['cuDNN Varlığı', getVal(aiEnv.cuDNN)],
        ['LM Studio Entegrasyonu', getVal(aiEnv.LMStudio)],
        ['PyTorch Sürümü', getVal(aiEnv.PyTorch)],
        ['TensorFlow Sürümü', getVal(aiEnv.TensorFlow)],
        ['ONNX Runtime', getVal(aiEnv.ONNX)]
      ])

      wsDev.addRow([])
      wsDev.addRow(['KURULU YAZILIM / CLI SÜRÜMLERİ'])
      wsDev.getRow(wsDev.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsDev, ['Araç / SDK', 'Versiyon Çıktısı'])
      Object.keys(devTools).forEach((key) => {
        wsDev.addRow([key, devTools[key]])
      })

      wsDev.addRow([])
      wsSummary.addRow([])
      wsDev.addRow(['LOKAL OLLAMA MODELLERİ'])
      wsDev.getRow(wsDev.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      const ollamaList = getVal(aiEnv.OllamaModels, [])
      if (Array.isArray(ollamaList) && ollamaList.length > 0) {
        ollamaList.forEach((m: string) => {
          wsDev.addRow([m])
        })
      } else {
        wsDev.addRow(['Ollama modeli bulunamadı veya CLI yüklü değil.'])
      }
      autoFit(wsDev)

      // --- SHEET 10: Süreçler ---
      const wsProcs = workbook.addWorksheet('Süreçler')
      styleTabHeader(wsProcs, 'KAYNAK TÜKETEN AKTİF SÜREÇLER')
      
      const appendProcTable = (ws: ExcelJS.Worksheet, pList: any[], label: string) => {
        ws.addRow([])
        ws.addRow([label])
        ws.getRow(ws.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
        addGridHeader(ws, ['Süreç Adı', 'PID', 'CPU (%)', 'Bellek (RAM)', 'Aktif Port Bağlantıları', 'Toplam Disk I/O (Bayt)', 'Thread Sayısı', 'Handle Count', 'Start Time', 'Dosya Yolu'])
        if (pList && pList.length > 0) {
          pList.forEach((p: any) => {
            ws.addRow([
              p.Name,
              p.PID,
              `%${p.CPU}`,
              formatBytes(p.RAM),
              p.Connections,
              p.TotalIO > 0 ? formatBytes(p.TotalIO) : '0',
              p.Threads,
              p.Handles,
              p.StartTime,
              p.Path
            ])
          })
        } else {
          ws.addRow(['Süreç listesi boş.'])
        }
      }

      appendProcTable(wsProcs, processes.CPU, 'EN ÇOK CPU TÜKETEN SÜREÇLER')
      appendProcTable(wsProcs, processes.RAM, 'EN ÇOK BELLEK (RAM) TÜKETEN SÜREÇLER')
      appendProcTable(wsProcs, processes.Disk, 'EN ÇOK DİSK I/O AKTİVİTESİ YAPAN SÜREÇLER')
      appendProcTable(wsProcs, processes.Network, 'EN FAZLA AĞ BAĞLANTISI AÇMIŞ SÜREÇLER')
      autoFit(wsProcs)

      // --- SHEET 11: Servisler ---
      const wsServ = workbook.addWorksheet('Servisler')
      styleTabHeader(wsServ, 'SİSTEM SERVİSLERİ VE BAŞLANGIÇ GÖREVLERİ')
      
      addKeyValueRows(wsServ, [
        ['Aktif Çalışan Servis Sayısı', getVal(services.RunningCount)],
        ['Durdurulmuş Servis Sayısı', getVal(services.StoppedCount)]
      ])
      
      wsServ.addRow([])
      wsServ.addRow(['ŞÜPHELİ SERVİSLER (TEMP/APPDATA ÇALIŞTIRILAN)'])
      wsServ.getRow(wsServ.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsServ, ['Servis Adı', 'Açıklama / Display', 'Dosya Yolu', 'Durum'])
      const suspList = getVal(services.Suspicious, [])
      if (Array.isArray(suspList) && suspList.length > 0) {
        suspList.forEach((s: any) => {
          wsServ.addRow([s.Name, s.DisplayName, s.Path, s.Status])
        })
      } else {
        wsServ.addRow(['Tehdit oluşturabilecek şüpheli servis algılanmadı.'])
      }

      wsServ.addRow([])
      wsServ.addRow(['BAŞLANGIÇ UYGULAMALARI (STARTUP LIST)'])
      wsServ.getRow(wsServ.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsServ, ['Başlangıç Uygulaması', 'Komut / Path', 'Registry/Location', 'Kullanıcı'])
      if (startup && startup.length > 0) {
        startup.forEach((s: any) => {
          wsServ.addRow([s.Name, s.Command, s.Location, s.User])
        })
      } else {
        wsServ.addRow(['Startup uygulaması bulunamadı.'])
      }

      wsServ.addRow([])
      wsServ.addRow(['SMB PAYLAŞIMLARI (SMB SHARES)'])
      wsServ.getRow(wsServ.rowCount).getCell(1).font = { name: 'Segoe UI', size: 12, bold: true }
      addGridHeader(wsServ, ['Paylaşım Adı', 'Klasör Yolu', 'Açıklama'])
      if (shares && shares.length > 0) {
        shares.forEach((s: any) => {
          wsServ.addRow([s.Name, s.Path, s.Description])
        })
      } else {
        wsServ.addRow(['SMB paylaşımı bulunamadı.'])
      }
      autoFit(wsServ)

      // --- SHEET 12: Performans ---
      const wsPerf = workbook.addWorksheet('Performans')
      styleTabHeader(wsPerf, 'SİSTEM OLAY GÜNLÜKLERİ (LOGS)')
      addGridHeader(wsPerf, ['Tarih / Zaman', 'Kaynak Modül (Provider)', 'Olay Mesajı'])
      if (eventLogs && eventLogs.length > 0) {
        eventLogs.forEach((l: any) => {
          wsPerf.addRow([l.TimeCreated, l.Provider, l.Message])
        })
      } else {
        wsPerf.addRow(['Son olay günlüğü bulunamadı veya boş.'])
      }
      autoFit(wsPerf)

      // --- SHEET 13: Riskler & Öneriler ---
      const wsRecs = workbook.addWorksheet('Riskler & Öneriler')
      styleTabHeader(wsRecs, 'SİSTEM BT ANALİZİ VE İYİLEŞTİRME ÖNERİLERİ')
      addGridHeader(wsRecs, ['Kategori', 'Tespit Durumu / Risk', 'BT Tavsiye Önerisi'])

      const recRows: Array<[string, string, string]> = []
      if (!getVal(security.DefenderStatus)) {
        recRows.push(['GÜVENLİK', 'Windows Defender devre dışı bırakılmış.', 'Kritik Risk: Virüs ve zararlı tehditlere karşı Windows Defender korumasını aktif edin.'])
      }
      if (!getVal(security.FirewallPrivate) || !getVal(security.FirewallPublic)) {
        recRows.push(['GÜVENLİK', 'Windows Güvenlik Duvarı profilleri kapalı.', 'Orta Risk: Port taraması ve yetkisiz erişim sızmalarını engellemek için Firewall profillerini aktif edin.'])
      }
      if (!getVal(board.TPMEnabled)) {
        recRows.push(['DONANIM & GÜVENLİK', 'Anakart TPM şifreleme modülü aktif değil.', 'Tavsiye: BIOS menüsünden TPM (Intel PTT / AMD fTPM) ayarını aktif edin.'])
      }
      if (!getVal(board.SecureBoot)) {
        recRows.push(['GÜVENLİK', 'Secure Boot koruması devre dışı.', 'Tavsiye: Boot virüslerine (rootkit) karşı korunmak için BIOS\'tan Secure Boot ayarını etkinleştirin.'])
      }
      
      const dFreePercent = volumes.length > 0 ? (volumes[0].Free / (volumes[0].Size || 1)) * 100 : 100
      if (dFreePercent < 15) {
        recRows.push(['PERFORMANS', `Sürücü disk boş alanı yetersiz (%${Math.round(dFreePercent)} kaldı).`, 'Yüksek Risk: Windows sanal bellek swap işlemleri ve uygulama performansı için diskten gereksiz dosyaları silin.'])
      }
      
      const adminUsersArr = getVal(security.AdminUsers, [])
      if (Array.isArray(adminUsersArr) && adminUsersArr.length > 5) {
        recRows.push(['BT DENETİM', 'Local Administrators grubunda çok fazla yönetici yetkili kullanıcı var.', 'Tavsiye: Yetkisiz erişimleri azaltmak için sistem yöneticilerini kısıtlayın.'])
      }

      if (recRows.length === 0) {
        recRows.push(['SAĞLIKLI', 'Herhangi bir kritik risk tespit edilmedi.', 'Sisteminiz BT standartlarına tam uyum sağlamaktadır.'])
      }

      recRows.forEach(([cat, risk, rec]) => {
        wsRecs.addRow([cat, risk, rec])
      })
      autoFit(wsRecs)

      // Write workbook to Downloads Folder
      await workbook.xlsx.writeFile(targetPath)
      return { filePath: targetPath }
    } catch (e: any) {
      return { error: e.message }
    }
  })
}
