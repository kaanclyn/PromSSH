import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  Cpu,
  HardDrive,
  Network,
  Activity,
  CheckCircle2,
  Terminal,
  Settings,
  Shield,
  Download,
  Zap,
  Clock,
  Monitor,
  Info,
  Play,
  Pause,
  AlertTriangle,
  Copy,
  X
} from 'lucide-react'

interface LocalSystemViewProps {
  onBack: () => void
}

interface ScanStep {
  id: number
  label: string
  status: 'pending' | 'scanning' | 'completed'
}

type ModalType =
  | 'cpu'
  | 'ram'
  | 'gpu'
  | 'disk'
  | 'network'
  | 'security'
  | 'devtools'
  | 'services'
  | 'startup'
  | 'windowsupdate'
  | 'ports'
  | 'shares'
  | 'remoteaccess'
  | 'aienvironment'
  | 'eventlogs'
  | null

type ModalTab = 'summary' | 'command' | 'raw'

// Sparkline Component to render mini charts
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color?: string }> = ({
  data,
  width = 70,
  height = 20,
  color = '#10b981'
}) => {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1" strokeDasharray="3,3" />
      </svg>
    )
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((val, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const LocalSystemView: React.FC<LocalSystemViewProps> = ({ onBack }) => {
  const [loading, setLoading] = useState<boolean>(true)
  const [systemData, setSystemData] = useState<any>(null)
  const [error, setError] = useState<string>('')

  // Export States
  const [exportJsonLoading, setExportJsonLoading] = useState<boolean>(false)
  const [exportExcelLoading, setExportExcelLoading] = useState<boolean>(false)
  
  // Custom Toast Notification State
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'excel' | 'json'
    path: string
  } | null>(null)

  // Live telemetry monitoring states
  const [liveInterval, setLiveInterval] = useState<number>(3) // 3 seconds default
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true)
  const [liveData, setLiveData] = useState<any>(null)
  
  // History lists for sparklines
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [ramHistory, setRamHistory] = useState<number[]>([])
  const [gpuHistory, setGpuHistory] = useState<number[]>([])
  const [diskHistory, setDiskHistory] = useState<number[]>([])
  const [netHistory, setNetHistory] = useState<number[]>([])

  // Modal drill-down states
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [activeTab, setActiveTab] = useState<ModalTab>('summary')

  // Previous network rx/tx bytes for rate computation
  const prevNetBytes = useRef<{ rx: number; tx: number; time: number } | null>(null)

  // Audit scanning simulation steps
  const [steps, setSteps] = useState<ScanStep[]>([
    { id: 1, label: 'Sistem kimliği ve Windows sürüm mimarisi çözümleniyor...', status: 'pending' },
    { id: 2, label: 'CPU mimarisi, base clock hızları ve önbellekleri hesaplanıyor...', status: 'pending' },
    { id: 3, label: 'Anakart, BIOS, UEFI, Secure Boot ve TPM entegrasyonu denetleniyor...', status: 'pending' },
    { id: 4, label: 'Fiziksel RAM modülleri, hızları ve ECC hata koruma durumları taranıyor...', status: 'pending' },
    { id: 5, label: 'NVIDIA CUDA / nvidia-smi VRAM ve GPU sıcaklık değerleri doğrulanıyor...', status: 'pending' },
    { id: 6, label: 'Fiziksel disk sağlık (SMART) verileri, partition stilleri sorgulanıyor...', status: 'pending' },
    { id: 7, label: 'Ağ adaptörleri, IPv4/IPv6 yapıları, DNS/Gateway ve Wi-Fi taranıyor...', status: 'pending' },
    { id: 8, label: 'BitLocker, Defender, UAC, Firewall ve local yöneticiler SID ile analiz ediliyor...', status: 'pending' },
    { id: 9, label: 'Geliştirici SDK, VS Code, Cursor, WSL ve Ollama ortamları test ediliyor...', status: 'pending' },
    { id: 10, label: 'Windows servisleri, başlangıç uygulamaları ve dinleyen TCP portları listeleniyor...', status: 'pending' }
  ])

  useEffect(() => {
    runSystemScan()
  }, [])

  // Live Telemetry Loop
  useEffect(() => {
    if (!isLiveActive || loading || error || !systemData) return

    let isMounted = true
    const fetchLive = async () => {
      try {
        const live = await window.api.getLiveTelemetry()
        if (!isMounted) return

        if (live && !live.error) {
          setLiveData(live)

          // 1. CPU Load
          const cpuVal = live.CPU || 0
          setCpuHistory((prev) => [...prev.slice(-14), cpuVal])

          // 2. RAM Percent
          const ramVal = live.RAM?.Percent || 0
          setRamHistory((prev) => [...prev.slice(-14), ramVal])

          // 3. GPU Load
          const gpuVal = live.GPU?.Utilization || 0
          setGpuHistory((prev) => [...prev.slice(-14), gpuVal])

          // 4. Disk IO total bytes
          const diskVal = (live.Disk?.ReadSpeed || 0) + (live.Disk?.WriteSpeed || 0)
          setDiskHistory((prev) => [...prev.slice(-14), diskVal])

          // 5. Network throughput rate computation
          const currentRx = live.Network?.RxBytes || 0
          const currentTx = live.Network?.TxBytes || 0
          const currentTime = Date.now()

          if (prevNetBytes.current) {
            const rxDiff = currentRx - prevNetBytes.current.rx
            const txDiff = currentTx - prevNetBytes.current.tx
            const timeDiff = (currentTime - prevNetBytes.current.time) / 1000
            
            if (timeDiff > 0 && rxDiff >= 0 && txDiff >= 0) {
              const netSpeed = (rxDiff + txDiff) / timeDiff
              setNetHistory((prev) => [...prev.slice(-14), netSpeed])
            }
          }
          prevNetBytes.current = { rx: currentRx, tx: currentTx, time: currentTime }
        }
      } catch (err) {
        console.error('Live telemetry fetch failure:', err)
      }
    }

    // Run immediately
    fetchLive()
    const timer = setInterval(fetchLive, liveInterval * 1000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [isLiveActive, liveInterval, loading, error, systemData])

  const runSystemScan = async (): Promise<void> => {
    try {
      for (let i = 0; i < steps.length; i++) {
        setSteps((prev) =>
          prev.map((step, idx) => {
            if (idx === i) return { ...step, status: 'scanning' }
            if (idx < i) return { ...step, status: 'completed' }
            return step
          })
        )
        await new Promise((r) => setTimeout(r, 150))
      }

      const info = await window.api.getLocalSystemInfo()
      if (info && info.error) {
        setError(info.error)
      } else {
        setSystemData(info)
        setSteps((prev) => prev.map((step) => ({ ...step, status: 'completed' })))
      }
    } catch (e: any) {
      setError(e.message || 'Yerel sistem taranırken hata oluştu.')
    } finally {
      setTimeout(() => {
        setLoading(false)
      }, 300)
    }
  }

  // WMI v2 field unpacker
  const getVal = (field: any, fallback: any = '-'): any => {
    if (field === null || field === undefined) return fallback
    if (typeof field === 'object' && field.value !== undefined) {
      return field.value !== null ? field.value : fallback
    }
    return field
  }

  const getSource = (field: any): string => {
    return field?.source ? field.source : 'N/A'
  }

  const getConfidence = (field: any): string => {
    return field?.confidence ? field.confidence : 'medium'
  }

  const getStatus = (field: any): string => {
    return field?.status ? field.status : 'ok'
  }

  const getError = (field: any): string => {
    return field?.error ? field.error : ''
  }

  // Formatter helpers
  const formatBytes = (bytes: any): string => {
    const val = typeof bytes === 'string' ? parseFloat(bytes) : bytes
    if (!val || isNaN(val)) return '0 GB'
    if (val < 1024 * 1024 * 1024) {
      return (val / (1024 * 1024)).toFixed(0) + ' MB'
    }
    return (val / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  const formatThroughput = (bytesPerSec: number): string => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
  }

  // Scores calculator
  const calculateScores = (): {
    hwScore: number
    perfScore: number
    secScore: number
    diskScore: number
    netScore: number
    devScore: number
    overallScore: number
  } => {
    if (!systemData) {
      return { hwScore: 0, perfScore: 0, secScore: 0, diskScore: 0, netScore: 0, devScore: 0, overallScore: 0 }
    }

    const cpu = systemData.CPU || {}
    const ram = systemData.RAM || {}
    const gpuList = systemData.GPU || []
    const disks = systemData.Disks || []
    const net = systemData.Internet || {}
    const sec = systemData.Security || {}
    const devTools = systemData.DevTools || {}

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

    // 2. Anlık Performans (Live telemetry based)
    let perf = 85
    if (liveData) {
      const cpuLoad = liveData.CPU || 5
      const ramPct = liveData.RAM?.Percent || 40
      perf = Math.max(10, Math.min(100, Math.round(100 - (cpuLoad * 0.5) - (ramPct * 0.2))))
    }

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

    return { hwScore: hw, perfScore: perf, secScore: security, diskScore: disk, netScore: networkScore, devScore: dev, overallScore: overall }
  }

  const getScoreText = (score: number): string => {
    if (score >= 90) return 'Çok İyi'
    if (score >= 75) return 'İyi'
    if (score >= 60) return 'Orta'
    if (score >= 40) return 'Riskli'
    return 'Kritik'
  }

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
    if (score >= 75) return 'text-indigo-500 border-indigo-500/20 bg-indigo-500/5'
    if (score >= 60) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'
    return 'text-red-500 border-red-500/20 bg-red-500/5'
  }

  const getScoreBarColor = (score: number): string => {
    if (score >= 90) return 'bg-emerald-500'
    if (score >= 75) return 'bg-indigo-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Export handlers
  const handleExportJson = async () => {
    if (!systemData) return
    setExportJsonLoading(true)
    try {
      const res = await window.api.exportJson(systemData)
      if (res && res.filePath) {
        setNotification({
          show: true,
          type: 'json',
          path: res.filePath
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setExportJsonLoading(false)
    }
  }

  const handleExportExcel = async () => {
    if (!systemData) return
    setExportExcelLoading(true)
    try {
      const res = await window.api.exportExcel(systemData)
      if (res && res.filePath) {
        setNotification({
          show: true,
          type: 'excel',
          path: res.filePath
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setExportExcelLoading(false)
    }
  }

  // Modal drill-down rendering helper
  const openModal = (type: ModalType) => {
    setActiveModal(type)
    setActiveTab('summary')
  }

  const renderModal = () => {
    if (!activeModal || !systemData) return null

    let modalTitle = ''
    let pScriptCommands: string[] = []
    let rawPayload: any = null
    let renderSummaryTab: () => React.ReactNode = () => null

    const cpu = systemData.CPU || {}
    const ram = systemData.RAM || {}
    const gpus = systemData.GPU || []
    const disks = systemData.Disks || []
    const volumes = systemData.Volumes || []
    const network = systemData.Network || []
    const wifi = systemData.WiFi || {}
    const ports = systemData.Ports || {}
    const security = systemData.Security || {}
    const devTools = systemData.DevTools || {}
    const startup = systemData.Startup || []
    const shares = systemData.Shares || []
    const remoteAccess = systemData.RemoteAccess || {}
    const aiEnv = systemData.AIEnvironment || {}
    const services = systemData.Services || {}
    const eventLogs = systemData.EventLogs || []

    const renderDataStatus = (field: any) => {
      const status = getStatus(field)
      if (status === 'error') {
        return (
          <div className="p-2.5 rounded-lg border border-red-500/10 bg-red-500/5 text-red-500 text-[10px] font-semibold flex items-center gap-2 mt-1">
            <AlertTriangle size={12} />
            <span>Okunamadı: {getError(field) || 'Erişim Engellendi (Yönetici Yetkisi Gerekebilir).'}</span>
          </div>
        )
      }
      return null
    }

    switch (activeModal) {
      case 'cpu':
        modalTitle = 'İşlemci (CPU) Detayları'
        pScriptCommands = ['Get-CimInstance Win32_Processor']
        rawPayload = cpu
        renderSummaryTab = () => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Model</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.Name)}</span>
                {renderDataStatus(cpu.Name)}
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Soket Yuvası</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.Socket)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Fiziksel Çekirdek</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.Cores)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Mantıksal İşlemci (Threads)</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.LogicalProcessors)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Temel / Maks Hız</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.BaseSpeed)} MHz / {getVal(cpu.MaxSpeed)} MHz</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Aktif Frekans Hızı</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.CurrentSpeed)} MHz</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Önbellek L2 / L3</span>
                <span className="font-extrabold text-slate-100">{getVal(cpu.L2Cache)} KB / {getVal(cpu.L3Cache)} KB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Sanallaştırma / Hyper-V</span>
                <span className="font-extrabold text-slate-100">
                  {getVal(cpu.Virtualization) ? 'Destekleniyor (Açık)' : 'Kapalı'} / {getVal(cpu.HyperV) ? 'Aktif' : 'Pasif'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-indigo-400 font-bold block mb-1">ÖNERİ & UYARI</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Eğer sanallaştırma pasif görünüyorsa Docker, WSL ve sanal makinelerin çalışabilmesi için BIOS ayarlarından Intel VMX / AMD SVM özelliğini aktif hale getirin.
              </p>
            </div>
          </div>
        )
        break

      case 'ram':
        modalTitle = 'Bellek (RAM) ve Slot Detayları'
        pScriptCommands = ['Get-CimInstance Win32_PhysicalMemory', 'Get-CimInstance Win32_PhysicalMemoryArray']
        rawPayload = ram
        renderSummaryTab = () => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs pb-3 border-b border-slate-850">
              <div>
                <span className="text-slate-400 block">Toplam Bellek</span>
                <span className="font-extrabold text-slate-100">{formatBytes(getVal(ram.Total))}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Kullanılabilir Boş Bellek</span>
                <span className="font-extrabold text-slate-100">{formatBytes(getVal(ram.Free))}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Anakart Fiziksel Slot Sayısı</span>
                <span className="font-extrabold text-slate-100">{getVal(ram.Slots)} Slot</span>
              </div>
              <div>
                <span className="text-slate-400 block">ECC Bellek Desteği</span>
                <span className="font-extrabold text-slate-100">{getVal(ram.ECC)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold text-indigo-400 block">Dolu RAM Yuvaları ({ram.Modules?.length || 0})</span>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {ram.Modules?.map((m: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono leading-relaxed">
                    <div className="flex justify-between font-black text-slate-200">
                      <span>{m.Locator} ({m.MemoryType} - {m.FormFactor})</span>
                      <span className="text-indigo-400">{formatBytes(m.Capacity)}</span>
                    </div>
                    <div className="flex justify-between mt-1 text-slate-500">
                      <span>Üretici: {m.Manufacturer}</span>
                      <span>Hız: {m.Speed} MHz (Configured: {m.ConfiguredClockSpeed} MHz)</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      P/N: {m.PartNumber} | S/N: {m.SerialNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
        break

      case 'gpu':
        modalTitle = 'Grafik İşlemci (GPU) Detayları'
        pScriptCommands = [
          'Get-CimInstance Win32_VideoController',
          'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,driver_version,temperature.gpu,utilization.gpu,power.draw'
        ]
        rawPayload = gpus
        renderSummaryTab = () => (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {gpus.map((g: any, idx: number) => (
              <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs leading-relaxed space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="font-extrabold text-slate-100 text-sm truncate max-w-[280px]" title={g.Name}>{g.Name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    g.Type === 'Dedicated' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>{g.Type}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 pt-1 font-mono text-[11px] text-slate-400">
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Üretici:</span> <span className="font-bold text-slate-200">{g.Vendor}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Toplam VRAM:</span> <span className="font-bold text-emerald-400">{formatBytes(g.VRAM)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Kullanılan VRAM:</span> <span className="font-bold text-slate-300">{g.VRAMUsed ? formatBytes(g.VRAMUsed) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Boş VRAM:</span> <span className="font-bold text-slate-350">{g.VRAMFree ? formatBytes(g.VRAMFree) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Driver Sürümü:</span> <span className="font-bold text-slate-250 truncate max-w-[120px]">{g.DriverVersion}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Sıcaklık / Yük:</span> <span className="font-bold text-slate-200">{g.Temp || 'N/A'} / {g.Load || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>Güç Tüketimi:</span> <span className="font-bold text-yellow-500">{g.Power || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850/50 pb-1">
                    <span>CUDA Sürümü:</span> <span className="font-bold text-indigo-400">{g.CUDASupported ? g.CUDAVersion : 'N/A'}</span>
                  </div>
                  <div className="col-span-2 flex justify-between">
                    <span>DirectX Desteği:</span> <span className="font-bold text-slate-200 truncate max-w-[280px]">{g.DirectX || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>Veri Kaynağı: {g.Source}</span>
                  <span className={`px-1.5 py-0.5 rounded font-black uppercase ${
                    g.Confidence === 'verified' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'text-yellow-500 border border-yellow-500/20 bg-yellow-500/5'
                  }`}>{g.Confidence === 'verified' ? 'Doğrulandı' : 'Tahmini'}</span>
                </div>
              </div>
            ))}
          </div>
        )
        break

      case 'disk':
        modalTitle = 'Depolama SMART & Bölüm Detayları'
        pScriptCommands = ['Get-PhysicalDisk', 'Get-Disk', 'Get-Volume', 'Get-StorageReliabilityCounter']
        rawPayload = { Disks: disks, Volumes: volumes }
        renderSummaryTab = () => (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-indigo-400 block uppercase tracking-wider">Fiziksel Disk Sürücüleri ({disks.length})</span>
              {disks.map((d: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono leading-relaxed">
                  <div className="flex justify-between font-black text-slate-200 border-b border-slate-850 pb-1">
                    <span>Disk {d.Number}: {d.Model}</span>
                    <span className="text-emerald-500">{d.Health}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-[10px] text-slate-500 mt-2">
                    <div className="flex justify-between"><span>Boyut:</span> <span className="text-slate-300 font-bold">{formatBytes(d.Size)}</span></div>
                    <div className="flex justify-between"><span>Bağlantı:</span> <span className="text-slate-300 font-bold">{d.BusType} ({d.Type})</span></div>
                    <div className="flex justify-between"><span>Firmware:</span> <span className="text-slate-300 font-bold">{d.Firmware}</span></div>
                    <div className="flex justify-between"><span>Bölüm Stili:</span> <span className="text-slate-300 font-bold">{d.PartitionStyle}</span></div>
                    <div className="flex justify-between"><span>Sıcaklık:</span> <span className="text-slate-300 font-bold">{d.Temperature}</span></div>
                    <div className="flex justify-between"><span>Çalışma Saati:</span> <span className="text-slate-300 font-bold">{d.PowerOnHours}</span></div>
                    <div className="flex justify-between"><span>Okuma / Yazma:</span> <span className="text-slate-300 font-bold truncate max-w-[90px]">{d.ReadBytesTotal !== 'N/A' ? formatBytes(d.ReadBytesTotal) : 'N/A'} / {d.WriteBytesTotal !== 'N/A' ? formatBytes(d.WriteBytesTotal) : 'N/A'}</span></div>
                    <div className="flex justify-between"><span>Durum:</span> <span className="text-slate-300 font-bold">{d.OperationalStatus}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-850">
              <span className="text-[11px] font-bold text-indigo-400 block uppercase tracking-wider">Mantıksal Sürücü Bölümleri ({volumes.length})</span>
              {volumes.map((v: any, idx: number) => {
                const used = v.Size - v.Free
                const pct = Math.round((used / (v.Size || 1)) * 100)
                return (
                  <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono">
                    <div className="flex justify-between items-center mb-2 font-bold text-slate-200">
                      <span>({v.Letter}:) {v.FileSystem}</span>
                      <span className="text-[10px] text-slate-500">{formatBytes(v.Free)} boş / {formatBytes(v.Size)} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-850 overflow-hidden">
                      <div className={`h-full ${pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
        break

      case 'network':
        modalTitle = 'Ağ Kartları ve Bağlantı Detayları'
        pScriptCommands = [
          'Get-NetAdapter',
          'Get-NetIPConfiguration',
          'Get-NetIPAddress',
          'netsh wlan show interfaces',
          'Get-NetTCPConnection'
        ]
        rawPayload = { Adapters: network, WiFi: wifi, Ports: ports }
        renderSummaryTab = () => (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4 text-xs pb-3 border-b border-slate-850">
              <div>
                <span className="text-slate-400 block">Wi-Fi Bağlantı (SSID)</span>
                <span className="font-extrabold text-slate-100">{getVal(wifi.SSID)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Wi-Fi Sinyal Gücü</span>
                <span className="font-extrabold text-slate-100">{getVal(wifi.Signal)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">İnternet Durumu (Google DNS)</span>
                <span className={`font-extrabold ${systemData.Internet?.Connected ? 'text-emerald-500' : 'text-red-500'}`}>
                  {systemData.Internet?.Connected ? `Bağlantı Var (${systemData.Internet.Latency} ms)` : 'İnternet Erişimi Yok'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Genel Dış (Public) IP</span>
                <span className="font-extrabold text-indigo-400 select-text">{systemData.Internet?.PublicIP || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Aktif TCP Bağlantıları</span>
                <span className="font-extrabold text-slate-100">{getVal(ports.ActiveTCPCount)} Bağlantı</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold text-indigo-400 block uppercase tracking-wider">Ağ Adaptörleri ({network.length})</span>
              {network.length === 0 && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-red-400">
                  Ağ adaptörleri okunamadı.<br />
                  <span className="text-[10px] text-slate-500 mt-1 block">Sebep: Yetki / PowerShell sorgu hatası / filtreleme hatası</span>
                </div>
              )}
              {network.map((n: any, idx: number) => (
                <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono leading-relaxed space-y-1.5">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-1">
                    <span className="font-black text-slate-200 truncate pr-2 max-w-[260px]">{n.Name}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] rounded font-black">{n.Speed}</span>
                  </div>
                  <div className="text-[10px] text-slate-550 truncate">{n.Description}</div>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-[10px] text-slate-400 pt-1">
                    <div className="flex justify-between"><span>Durum:</span> <span className="font-bold text-slate-300">{n.Status}</span></div>
                    <div className="flex justify-between"><span>MAC:</span> <span className="font-bold text-slate-350">{n.MAC}</span></div>
                    <div className="flex justify-between"><span>Gateway:</span> <span className="font-bold text-slate-300 truncate max-w-[100px]">{n.Gateway}</span></div>
                    <div className="flex justify-between"><span>DHCP:</span> <span className="font-bold text-slate-300">{n.DHCPEnabled ? 'Açık' : 'Statik IP'}</span></div>
                    <div className="col-span-2"><span>IPv4:</span> <span className="font-bold text-indigo-400 select-text">{Array.isArray(n.IPv4) ? n.IPv4.join(', ') : n.IPv4}</span></div>
                    <div className="col-span-2 truncate"><span>IPv6:</span> <span className="font-bold text-indigo-400/80 select-text">{Array.isArray(n.IPv6) ? n.IPv6.join(', ') : n.IPv6}</span></div>
                    <div className="col-span-2 truncate"><span>DNS:</span> <span className="font-bold text-slate-300">{Array.isArray(n.DNS) ? n.DNS.join(', ') : n.DNS}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
        break

      case 'security':
        modalTitle = 'BT Güvenlik Denetim Raporu'
        pScriptCommands = [
          'Get-MpComputerStatus',
          'Get-NetFirewallProfile',
          'Get-BitLockerVolume',
          'Get-LocalGroupMember -Group Administrators',
          'Get-ExecutionPolicy',
          'Get-WinEvent -LogName Security -ID 4625'
        ]
        rawPayload = security
        renderSummaryTab = () => {
          const bitlockerList = getVal(security.BitLocker, [])
          const failedList = getVal(security.FailedLogins)
          return (
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4 text-xs pb-3 border-b border-slate-850">
                <div>
                  <span className="text-slate-400 block">Windows Defender AM</span>
                  <span className={`font-extrabold ${getVal(security.DefenderStatus) ? 'text-emerald-500' : 'text-red-500'}`}>
                    {getVal(security.DefenderStatus) ? 'Real-Time Aktif' : 'Devre Dışı (Tehlikeli!)'}
                  </span>
                  {renderDataStatus(security.DefenderStatus)}
                </div>
                <div>
                  <span className="text-slate-400 block">RDP (Uzak Masaüstü)</span>
                  <span className={`font-extrabold ${getVal(security.RDPEnabled) ? 'text-yellow-500' : 'text-emerald-500'}`}>
                    {getVal(security.RDPEnabled) ? 'Açık / Yetkilendirilmiş' : 'Kapalı (Güvenli)'}
                  </span>
                  {renderDataStatus(security.RDPEnabled)}
                </div>
                <div>
                  <span className="text-slate-400 block">Firewall (Etki Alanı / Özel / Ortak)</span>
                  <span className="font-extrabold text-slate-100">
                    {getVal(security.FirewallDomain) ? 'A' : 'K'} / {getVal(security.FirewallPrivate) ? 'A' : 'K'} / {getVal(security.FirewallPublic) ? 'A' : 'K'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">UAC (User Account Control)</span>
                  <span className={`font-extrabold ${getVal(security.UACEnabled) ? 'text-emerald-500' : 'text-red-500'}`}>
                    {getVal(security.UACEnabled) ? 'Etkin (Güvenli)' : 'Kapalı (Tehlikeli!)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">PowerShell Execution Policy</span>
                  <span className="font-extrabold text-slate-100">{getVal(security.ExecutionPolicy)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Uzak Erişim Kanalları (AnyDesk / SSH)</span>
                  <span className="font-extrabold text-slate-100">{remoteAccess.AnyDesk === 'Installed/Running' ? 'AnyDesk Açık' : 'AnyDesk Yok'} / {remoteAccess.SSH === 'Installed/Running' ? 'SSH Açık' : 'SSH Yok'}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs leading-normal">
                <span className="text-[10px] text-indigo-400 font-bold block mb-1">Local Administrators (Yöneticiler)</span>
                <p className="font-mono text-slate-300 font-bold break-all">
                  {Array.isArray(getVal(security.AdminUsers)) ? getVal(security.AdminUsers).join(', ') : getVal(security.AdminUsers)}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-indigo-400 block uppercase tracking-wider">BitLocker Disk Şifreleme</span>
                {Array.isArray(bitlockerList) && bitlockerList.length > 0 ? (
                  bitlockerList.map((b: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono flex justify-between">
                      <span>Sürücü {b.DriveLetter}</span>
                      <span>{b.Status} (%{b.EncryptionPercent})</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-500 font-mono">
                    Şifreli disk sürücüsü bulunamadı.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-indigo-400 block uppercase tracking-wider">Son Başarısız Giriş Denemeleri (failed logons)</span>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono leading-relaxed space-y-1.5 max-h-[120px] overflow-y-auto">
                  {Array.isArray(failedList) ? (
                    failedList.map((line: string, idx: number) => (
                      <div key={idx} className="text-red-400 border-b border-slate-850/50 pb-1 last:border-0 last:pb-0">{line}</div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic">{failedList}</div>
                  )}
                </div>
              </div>
            </div>
          )
        }
        break

      case 'devtools':
        modalTitle = 'Geliştirici Ortamı (SDK) Detayları'
        pScriptCommands = ['node -v', 'npm -v', 'pnpm -v', 'git --version', 'docker version', 'wsl --list', 'ollama list']
        rawPayload = { DevTools: devTools, AIEnvironment: aiEnv }
        renderSummaryTab = () => (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4 text-xs pb-3 border-b border-slate-850">
              <div>
                <span className="text-slate-400 block">CUDA Sürümü</span>
                <span className="font-extrabold text-indigo-400">{aiEnv.CUDAVersion || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">cuDNN Entegrasyonu</span>
                <span className="font-extrabold text-slate-100">{aiEnv.cuDNN || 'Not Detected'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">PyTorch Versiyon</span>
                <span className="font-extrabold text-slate-100">{aiEnv.PyTorch || 'Not Detected'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">TensorFlow Versiyon</span>
                <span className="font-extrabold text-slate-100">{aiEnv.TensorFlow || 'Not Detected'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">ONNX Runtime</span>
                <span className="font-extrabold text-slate-100">{aiEnv.ONNX || 'Not Detected'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">LM Studio Öncache</span>
                <span className="font-extrabold text-slate-100">{aiEnv.LMStudio || 'Not Detected'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-indigo-400 block uppercase">Lokal Ollama Modelleri</span>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono leading-relaxed space-y-1 max-h-[120px] overflow-y-auto">
                {aiEnv.OllamaModels && aiEnv.OllamaModels.length > 0 ? (
                  aiEnv.OllamaModels.map((m: string, idx: number) => (
                    <div key={idx} className="text-slate-300 font-bold">{m}</div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">Ollama modeli bulunamadı veya CLI kapalı.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-indigo-400 block uppercase">Kurulu Yazılımlar ve CLI Sürümleri</span>
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                {Object.keys(devTools).map((key) => (
                  <div key={key} className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex justify-between gap-2">
                    <span className="font-bold text-slate-400 shrink-0">{key}:</span>
                    <span className="text-indigo-400 truncate text-right font-black" title={devTools[key]}>{devTools[key]?.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
        break

      case 'services':
        modalTitle = 'Windows Servisleri & Paylaşımlar'
        pScriptCommands = [
          'Get-Service',
          'Get-CimInstance Win32_Service',
          'Get-CimInstance Win32_StartupCommand',
          'Get-SmbShare'
        ]
        rawPayload = { Services: services, Startup: startup, Shares: shares }
        renderSummaryTab = () => (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4 text-xs pb-3 border-b border-slate-850">
              <div>
                <span className="text-slate-400 block">Çalışan Servisler</span>
                <span className="font-extrabold text-emerald-500">{services.RunningCount || 0} Servis</span>
              </div>
              <div>
                <span className="text-slate-400 block">Durdurulmuş Servisler</span>
                <span className="font-extrabold text-slate-400">{services.StoppedCount || 0} Servis</span>
              </div>
              <div>
                <span className="text-slate-400 block">Başlangıç Uygulamaları (Startup)</span>
                <span className="font-extrabold text-indigo-400">{startup.length} Kayıt</span>
              </div>
              <div>
                <span className="text-slate-400 block">Lokal SMB Paylaşımları</span>
                <span className="font-extrabold text-indigo-400">{shares.length} Paylaşım</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-red-400 block uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={12} /> Şüpheli Servisler Heuristics ({services.Suspicious?.length || 0})
              </span>
              <div className="space-y-2">
                {services.Suspicious && services.Suspicious.length > 0 ? (
                  services.Suspicious.map((s: any, idx: number) => (
                    <div key={idx} className="p-3 bg-red-950/10 border border-red-500/20 rounded-xl text-[10px] font-mono">
                      <div className="flex justify-between font-bold text-red-400">
                        <span>{s.DisplayName} ({s.Name})</span>
                        <span className="uppercase">{s.Status}</span>
                      </div>
                      <div className="text-slate-500 mt-1 break-all select-text">Path: {s.Path}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-500 italic">
                    Temp veya AppData klasöründen tetiklenen şüpheli bir servis algılanmadı (Güvenli).
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-indigo-400 block uppercase tracking-wider">Lokal SMB Sürücü Paylaşımları ({shares.length})</span>
              <div className="space-y-2">
                {shares.map((s: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono leading-normal">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>Paylaşım: {s.Name}</span>
                    </div>
                    <div className="text-slate-500 mt-0.5 truncate select-text">Klasör: {s.Path}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
        break

      case 'eventlogs':
        modalTitle = 'Sistem Olay Günlükleri (Windows Logs)'
        pScriptCommands = ['Get-WinEvent -LogName System -Level 1,2 -MaxEvents 10']
        rawPayload = eventLogs
        renderSummaryTab = () => (
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-red-400 block uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} /> Kritik ve Hata Olay Günlükleri (Son 10 Kayıt)
            </span>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {eventLogs.length === 0 && (
                <p className="text-slate-500 italic text-xs text-center py-8">Hata veya kritik olay kaydı bulunamadı.</p>
              )}
              {eventLogs.map((l: any, idx: number) => (
                <div key={idx} className="p-3 bg-red-950/10 border border-red-500/15 rounded-xl text-[10px] font-mono leading-relaxed">
                  <div className="flex justify-between font-black text-red-400 border-b border-red-500/10 pb-1">
                    <span>{l.Provider}</span>
                    <span>{l.TimeCreated}</span>
                  </div>
                  <div className="text-slate-300 mt-1.5 select-text">{l.Message}</div>
                </div>
              ))}
            </div>
          </div>
        )
        break

      default:
        return null
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-850 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
          
          {/* Modal Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-850 shrink-0">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-indigo-500" />
              <h3 className="text-lg font-black text-slate-950 dark:text-white">{modalTitle}</h3>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Tabs */}
          <div className="flex gap-2 px-6 pt-3 shrink-0">
            {(['summary', 'command', 'raw'] as ModalTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab === 'summary' ? 'Özet Rapor' : tab === 'command' ? 'PowerShell Komutları' : 'Ham Veri / Kaynak'}
              </button>
            ))}
          </div>

          {/* Modal Body */}
          <div className="flex-grow p-6 overflow-y-auto select-text leading-relaxed">
            {activeTab === 'summary' && renderSummaryTab()}
            
            {activeTab === 'command' && (
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-450 dark:text-slate-500 uppercase block">Bu veriyi almak için çalıştırılan komutlar:</span>
                <div className="space-y-2">
                  {pScriptCommands.map((cmd, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850/60 rounded-xl font-mono text-[10px] text-slate-800 dark:text-slate-350 select-all leading-normal">
                      {cmd}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850/50 rounded-xl grid grid-cols-2 gap-4 font-mono text-[10px] text-slate-450 dark:text-slate-500 leading-none">
                  <div>Kaynak: <span className="font-bold text-slate-800 dark:text-slate-350">{rawPayload?.Source || getSource(rawPayload) || 'WMI & Registry'}</span></div>
                  <div className="text-right">Doğrulama: <span className="font-bold text-slate-800 dark:text-slate-350 capitalize">{rawPayload?.Confidence || getConfidence(rawPayload) || 'medium'}</span></div>
                </div>
                <div className="p-4 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850/60 rounded-2xl max-h-[250px] overflow-auto font-mono text-[9px] text-emerald-600 dark:text-emerald-400 select-all leading-normal">
                  <pre>{JSON.stringify(rawPayload, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative select-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-lg p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-2xl relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-xl font-black tracking-wide text-slate-950 dark:text-white uppercase">
              PromHub Sistem Audit Analizi Başladı
            </h2>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-850/50">
                <span className={`text-xs font-semibold ${
                  step.status === 'scanning' ? 'text-indigo-650 dark:text-indigo-400' :
                  step.status === 'completed' ? 'text-emerald-650 dark:text-emerald-400 font-bold' :
                  'text-slate-400 dark:text-slate-500'
                }`}>
                  {step.label}
                </span>
                <div>
                  {step.status === 'scanning' && (
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {step.status === 'completed' && (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono mt-6 text-center select-none animate-pulse">
            Local PowerShell CIM & WMI envanter motoru aktif...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-4 border border-red-500/20">
          <Shield size={36} />
        </div>
        <h3 className="text-lg font-bold mb-2 text-red-400">Analiz Başarısız</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md text-center leading-relaxed font-mono bg-slate-100 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-850 mb-6">
          {error}
        </p>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Geri Dön
        </button>
      </div>
    )
  }

  const os = systemData?.OS || {}
  const cpu = systemData?.CPU || {}
  const board = systemData?.Motherboard || {}
  const ram = systemData?.RAM || { Modules: [] }
  const gpuList = systemData?.GPU || []
  const disks = systemData?.Disks || []
  const network = systemData?.Network || []
  const devTools = systemData?.DevTools || {}
  const services = systemData?.Services || {}
  const security = systemData?.Security || {}
  const aiEnv = systemData?.AIEnvironment || {}
  const eventLogs = systemData?.EventLogs || []
  
  // Scores
  const { hwScore, perfScore, secScore, diskScore, netScore, devScore, overallScore } = calculateScores()

  return (
    <div className="flex-grow flex flex-col p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Action panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 transition text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            title="Geri Dön"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
              Sistem Analiz Envanteri
              <Zap size={22} className="text-emerald-500 animate-pulse" />
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-mono font-bold tracking-tight uppercase mt-0.5">
              {getVal(os.Username)} @ {getVal(os.Hostname)}
            </p>
          </div>
        </div>

        {/* Buttons JSON and Excel report */}
        <div className="flex items-center gap-3">
          {/* Telemetry Loop Toggle controls */}
          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/30 p-1 rounded-xl shadow-sm mr-2">
            <button
              onClick={() => setIsLiveActive(!isLiveActive)}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isLiveActive ? 'bg-indigo-600/10 text-indigo-500' : 'text-slate-400 hover:text-slate-600'
              }`}
              title={isLiveActive ? 'Canlı Telemetriyi Duraklat' : 'Canlı Telemetriyi Başlat'}
            >
              {isLiveActive ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <select
              value={liveInterval}
              onChange={(e) => setLiveInterval(parseInt(e.target.value))}
              className="bg-transparent border-0 text-[10px] font-bold text-slate-600 dark:text-slate-400 px-1 py-0.5 focus:outline-none cursor-pointer"
              title="Güncelleme Hızı"
            >
              <option value="1" className="bg-white dark:bg-slate-900">1sn</option>
              <option value="3" className="bg-white dark:bg-slate-900">3sn</option>
              <option value="5" className="bg-white dark:bg-slate-900">5sn</option>
              <option value="10" className="bg-white dark:bg-slate-900">10sn</option>
            </select>
          </div>

          <button
            onClick={handleExportJson}
            disabled={exportJsonLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            {exportJsonLoading ? 'JSON Hazırlanıyor...' : 'JSON Raporu İndir'}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exportExcelLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            {exportExcelLoading ? 'Excel Hazırlanıyor...' : 'Excel Raporu İndir'}
          </button>
        </div>
      </div>

      {/* SYSTEM SCORES ROW */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-8 relative z-10">
        {[
          { title: 'Genel Değerlendirme', val: overallScore },
          { title: 'Donanım Kalitesi', val: hwScore },
          { title: 'Anlık Performans', val: perfScore },
          { title: 'Sistem Güvenliği', val: secScore },
          { title: 'Disk Sağlık Durumu', val: diskScore },
          { title: 'Ağ Bağlantısı', val: netScore },
          { title: 'Geliştirici Ortamı', val: devScore }
        ].map((score, idx) => (
          <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between ${getScoreColor(score.val)}`}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 leading-tight">
                {score.title}
              </span>
              <span className="text-2xl font-black mt-2 block tracking-tight">
                {score.val}<span className="text-xs font-semibold opacity-60">/100</span>
              </span>
            </div>
            <div className="mt-3">
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                <div className={`h-full ${getScoreBarColor(score.val)}`} style={{ width: `${score.val}%` }} />
              </div>
              <span className="text-[9px] font-bold block mt-1.5 text-right uppercase tracking-wider">
                {getScoreText(score.val)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* DYNAMIC TELEMETRY SPARKLINES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 relative z-10 bg-white/40 dark:bg-slate-900/15 border border-slate-200/50 dark:border-slate-850/40 p-4 rounded-2xl backdrop-blur-md">
        
        {/* CPU utilization live */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">CPU Kullanımı</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">%{liveData?.CPU || 0}</span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Sparkline data={cpuHistory} color="#4f46e5" />
            <span className="text-[9px] text-slate-450 dark:text-slate-600 font-mono">Live telemetry</span>
          </div>
        </div>

        {/* RAM utilization live */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">RAM Kullanımı</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">%{liveData?.RAM?.Percent || 0}</span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Sparkline data={ramHistory} color="#10b981" />
            <span className="text-[9px] text-slate-450 dark:text-slate-600 font-mono">{formatBytes(liveData?.RAM?.Used)}</span>
          </div>
        </div>

        {/* GPU utilization live */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">GPU Yükü / Temp</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">
              %{liveData?.GPU?.Utilization || 0} <span className="text-xs font-normal text-orange-400">{liveData?.GPU?.Temp}°C</span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Sparkline data={gpuHistory} color="#f59e0b" />
            <span className="text-[9px] text-slate-450 dark:text-slate-600 font-mono">{formatBytes(liveData?.GPU?.VRAMUsed)}</span>
          </div>
        </div>

        {/* Disk IO live */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">Disk I/O Hızı</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono truncate max-w-[110px]">
              {formatThroughput((liveData?.Disk?.ReadSpeed || 0) + (liveData?.Disk?.WriteSpeed || 0))}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Sparkline data={diskHistory} color="#06b6d4" />
            <span className="text-[9px] text-slate-450 dark:text-slate-600 font-mono">Read & Write</span>
          </div>
        </div>

        {/* Network speeds live */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">Ağ Transferi</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono truncate max-w-[110px]">
              {netHistory.length > 0 ? formatThroughput(netHistory[netHistory.length - 1]) : '0 B/s'}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Sparkline data={netHistory} color="#ec4899" />
            <span className="text-[9px] text-slate-450 dark:text-slate-600 font-mono">Upload & Rx</span>
          </div>
        </div>

      </div>

      {/* DASHBOARD DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        
        {/* Operating System Details Card */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Settings size={16} /> İşletim Sistemi & Windows
            </h3>
            <span className="text-[10px] text-slate-450 dark:text-slate-600 font-mono">WMI/Reg</span>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-450 dark:text-slate-500 font-semibold block leading-none">Sürüm</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-100 mt-1.5 block">{getVal(os.Caption)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-450 dark:text-slate-500 font-semibold block leading-none">Versiyon (Build)</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100 mt-1 block truncate">{getVal(os.Version)} ({getVal(os.Build)})</span>
              </div>
              <div>
                <span className="text-slate-450 dark:text-slate-500 font-semibold block leading-none">Dil & Bölge</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100 mt-1 block truncate">{getVal(os.Locale)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-450 dark:text-slate-500 font-semibold block leading-none">Sistem Uptime</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-100 mt-1 block flex items-center gap-1 font-mono text-[10px]">
                  <Clock size={11} className="text-emerald-500 shrink-0" />
                  {getVal(os.Uptime)}
                </span>
              </div>
              <div>
                <span className="text-slate-450 dark:text-slate-500 font-semibold block leading-none">Reboot Durumu</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded mt-1.5 inline-block border ${
                  getVal(os.PendingReboot) ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                }`}>
                  {getVal(os.PendingReboot) ? 'Reboot Bekleniyor' : 'Yeniden Başlatma Yok'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CPU & Motherboard Card (Clickable) */}
        <div
          onClick={() => openModal('cpu')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={16} /> İşlemci (CPU) & Anakart
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Detayları Aç</span>
          </div>
          <div className="space-y-3.5 flex-grow text-xs leading-relaxed">
            <div>
              <span className="text-slate-450 dark:text-slate-500 font-medium">İşlemci Modeli</span>
              <p className="font-black text-slate-850 dark:text-slate-100 mt-0.5 truncate">{getVal(cpu.Name)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-450 dark:text-slate-500 font-medium">Çekirdekler / Threads</span>
                <p className="font-extrabold text-slate-850 dark:text-slate-100 mt-0.5">{getVal(cpu.Cores)} Cores / {getVal(cpu.LogicalProcessors)} Threads</p>
              </div>
              <div>
                <span className="text-slate-450 dark:text-slate-500 font-medium">Base Clock Speed</span>
                <p className="font-extrabold text-slate-850 dark:text-slate-100 mt-0.5">{getVal(cpu.BaseSpeed)} MHz</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-850/50">
              <span className="text-slate-450 dark:text-slate-500 font-semibold block mb-1">Anakart Model Tanımı</span>
              <p className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                {getVal(board.Manufacturer)} {getVal(board.Product)}
              </p>
              <div className="flex gap-2 mt-2 font-mono text-[9px]">
                <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850/50 rounded">UEFI: {getVal(board.UEFI) ? 'Evet' : 'Legacy'}</span>
                <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850/50 rounded">TPM: {getVal(board.TPMEnabled) ? 'Aktif' : 'Yok'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Memory RAM Configuration Card (Clickable) */}
        <div
          onClick={() => openModal('ram')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} /> Bellek (RAM) Slot Haritası
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Slot Detayları</span>
          </div>
          <div className="space-y-4 flex-grow text-xs leading-relaxed">
            <div>
              <div className="flex justify-between items-center mb-1.5 font-semibold">
                <span className="text-slate-450 dark:text-slate-500">Bellek Toplamı</span>
                <span className="text-slate-700 dark:text-slate-350">{formatBytes(getVal(ram.Total))}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <span className="text-slate-450 block leading-none">Dolu / Toplam Slot</span>
                  <span className="font-extrabold text-slate-850 dark:text-slate-100 mt-1 block">{ram.Modules?.length || 0} / {getVal(ram.Slots)} Slot</span>
                </div>
                <div>
                  <span className="text-slate-450 block leading-none">Hata Algılama (ECC)</span>
                  <span className="font-extrabold text-slate-850 dark:text-slate-100 mt-1 block truncate">{getVal(ram.ECC)}</span>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-850/50 flex flex-wrap gap-1.5 max-h-[70px] overflow-y-auto">
              {ram.Modules?.map((mod: any, index: number) => (
                <div key={index} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850/50 font-mono text-[9px] text-slate-600 dark:text-slate-400 font-bold">
                  Slot {index}: {formatBytes(mod.Capacity)} ({mod.Speed} MHz)
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GPU Video Cards Card (Clickable) */}
        <div
          onClick={() => openModal('gpu')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Monitor size={16} /> Grafik Birimi (GPU) & NVIDIA-SMI
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Kart Detayları</span>
          </div>
          <div className="space-y-3.5 flex-grow text-xs leading-relaxed max-h-[170px] overflow-y-auto pr-1">
            {gpuList.map((g: any, index: number) => (
              <div key={index} className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60">
                <span className="font-black text-slate-800 dark:text-slate-100 block truncate" title={g.Name}>{g.Name}</span>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500 font-mono">
                  <span>VRAM: {formatBytes(g.VRAM)}</span>
                  <span className="text-indigo-500 font-bold">{g.Source} ({g.Confidence})</span>
                </div>
              </div>
            ))}
            {gpuList.length === 0 && (
              <p className="text-slate-500 italic py-4 text-center">Video bağdaştırıcı bulunamadı.</p>
            )}
          </div>
        </div>

        {/* Depolama SMART ve Bölümler (Clickable) */}
        <div
          onClick={() => openModal('disk')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <HardDrive size={16} /> Disk Sürücüleri & SMART
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">SMART Aç</span>
          </div>
          <div className="space-y-3 flex-grow text-xs max-h-[170px] overflow-y-auto pr-1">
            {disks.map((d: any, index: number) => (
              <div key={index} className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60 leading-normal">
                <div className="flex justify-between font-black text-slate-800 dark:text-slate-150">
                  <span className="truncate max-w-[130px]">{d.Model}</span>
                  <span className="text-emerald-500">{d.Health}</span>
                </div>
                <div className="flex justify-between mt-0.5 text-[9px] font-mono text-slate-500">
                  <span>{formatBytes(d.Size)} ({d.BusType})</span>
                  <span>{d.Temperature !== 'N/A' ? d.Temperature : ''}</span>
                </div>
              </div>
            ))}
            {disks.length === 0 && (
              <p className="text-slate-500 italic py-4 text-center">Fiziksel disk bulunamadı.</p>
            )}
          </div>
        </div>

        {/* Ağ Bağdaştırıcıları (Clickable) */}
        <div
          onClick={() => openModal('network')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Network size={16} /> Ağ Kartları & Bağlantı
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Kart Detayları</span>
          </div>
          <div className="space-y-3 flex-grow text-xs max-h-[170px] overflow-y-auto pr-1">
            {network.length === 0 && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 text-[10px] leading-relaxed">
                Ağ adaptörleri okunamadı.<br />
                <span className="text-[9px] text-slate-500 block mt-0.5">Yetki veya WMI/CIM hata durumu.</span>
              </div>
            )}
            {network.map((n: any, index: number) => (
              <div key={index} className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60 leading-none flex justify-between items-center">
                <span className="font-bold text-slate-800 dark:text-slate-150 truncate pr-2 max-w-[120px]">{n.Name}</span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">{n.Speed}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Card (Clickable) */}
        <div
          onClick={() => openModal('security')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Shield size={16} /> BT Güvenlik Audit Denetimi
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Güvenlik Raporu</span>
          </div>
          <div className="space-y-2.5 flex-grow text-xs">
            <div className="flex justify-between items-center p-2 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60">
              <span>Windows Defender:</span>
              <span className={`font-black text-[10px] uppercase ${getVal(security.DefenderStatus) ? 'text-emerald-500' : 'text-red-500'}`}>
                {getVal(security.DefenderStatus) ? 'Aktif' : 'Devre Dışı'}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60">
              <span>Uzak Masaüstü (RDP):</span>
              <span className={`font-black text-[10px] uppercase ${getVal(security.RDPEnabled) ? 'text-yellow-500' : 'text-emerald-500'}`}>
                {getVal(security.RDPEnabled) ? 'Açık' : 'Kapalı'}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60">
              <span>User Account Control (UAC):</span>
              <span className={`font-black text-[10px] uppercase ${getVal(security.UACEnabled) ? 'text-emerald-500' : 'text-red-500'}`}>
                {getVal(security.UACEnabled) ? 'Etkin' : 'Kapalı'}
              </span>
            </div>
          </div>
        </div>

        {/* Services & Startup Apps Card (Clickable) */}
        <div
          onClick={() => openModal('services')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={16} /> Servisler, Startup & SMB
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Görüntüle</span>
          </div>
          <div className="space-y-3 flex-grow text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-450 block leading-none">Aktif Servisler</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-100 mt-1 block font-mono">{services.RunningCount || 0} Aktif</span>
              </div>
              <div>
                <span className="text-slate-450 block leading-none">Duran Servisler</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-350 mt-1 block font-mono">{services.StoppedCount || 0} Duran</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60 flex justify-between items-center">
              <span>Şüpheli Servis Sayısı:</span>
              <span className={`font-black text-[10px] ${services.Suspicious?.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {services.Suspicious?.length || 0} Tehdit
              </span>
            </div>
          </div>
        </div>

        {/* Developer SDKs & AI Environments Card (Clickable) */}
        <div
          onClick={() => openModal('devtools')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm flex flex-col cursor-pointer hover:border-indigo-500/35 transition duration-200 group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={16} /> Geliştirici SDK & AI Ortamı
            </h3>
            <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Geliştirici Odası</span>
          </div>
          <div className="space-y-3.5 flex-grow text-xs max-h-[170px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-1.5 rounded bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850/50 flex justify-between">
                <span>Node:</span> <span className="font-bold text-indigo-400 truncate max-w-[50px]">{devTools.Node?.split(' ')[0]}</span>
              </div>
              <div className="p-1.5 rounded bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850/50 flex justify-between">
                <span>Git:</span> <span className="font-bold text-indigo-400 truncate max-w-[50px]">{devTools.Git?.split(' ')[0]}</span>
              </div>
              <div className="p-1.5 rounded bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850/50 flex justify-between">
                <span>Docker:</span> <span className="font-bold text-indigo-400 truncate max-w-[50px]">{devTools.Docker?.split(' ')[0]}</span>
              </div>
              <div className="p-1.5 rounded bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850/50 flex justify-between">
                <span>Python:</span> <span className="font-bold text-indigo-400 truncate max-w-[50px]">{devTools.Python?.split(' ')[0]}</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850/60 flex justify-between text-[10px] font-mono">
              <span>CUDA Toolkit Sürümü:</span>
              <span className="font-bold text-slate-200">{aiEnv.CUDAVersion || 'Yok'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Rapor Olay Günlükleri (Clickable Card at Bottom Left) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 relative z-10">
        <div
          onClick={() => openModal('eventlogs')}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm cursor-pointer hover:border-red-500/20 transition duration-200 group flex flex-col justify-between"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={16} /> Sistem Olay Günlükleri (Hatalar)
            </h3>
            <span className="text-[10px] text-red-400 font-mono font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200">Logları Aç</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 leading-normal flex-grow flex items-center">
            {eventLogs.length > 0 ? (
              <p>Sistemde son dönemde <span className="text-red-400 font-bold font-mono">{eventLogs.length} kritik hata/uyarı</span> günlüğü algılandı. Ayrıntılar için tıklayın.</p>
            ) : (
              <p>Sistem loglarında herhangi bir hata günlüğü bulunmadı (Güvenli).</p>
            )}
          </div>
        </div>

        {/* 9. Top Resource hogs processes */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/25 backdrop-blur-md shadow-sm">
          <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={16} /> En Çok Kaynak Tüketen Süreçler (Canlı)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top CPU */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 pb-1 border-b border-slate-100 dark:border-slate-850/30">Top CPU Süreçleri</span>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {(liveData?.Processes?.CPU || systemData?.Processes?.CPU)?.slice(0, 5).map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950/30 text-[11px] font-mono leading-none">
                    <span className="text-slate-800 dark:text-slate-350 truncate w-1/2" title={p.Name}>{p.Name} ({p.PID})</span>
                    <span className="text-indigo-500 text-center w-1/4 font-black">%{p.CPU}</span>
                    <span className="text-slate-450 w-1/4 text-right">{formatBytes(p.RAM)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top RAM */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 pb-1 border-b border-slate-100 dark:border-slate-850/30">Top RAM Süreçleri</span>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {(liveData?.Processes?.RAM || systemData?.Processes?.RAM)?.slice(0, 5).map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950/30 text-[11px] font-mono leading-none">
                    <span className="text-slate-800 dark:text-slate-350 truncate w-1/2" title={p.Name}>{p.Name} ({p.PID})</span>
                    <span className="text-indigo-500 text-center w-1/4 font-black">%{p.CPU}</span>
                    <span className="text-slate-455 text-emerald-500 w-1/4 text-right font-black">{formatBytes(p.RAM)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE DETAILED MODAL */}
      {renderModal()}

      {/* EXPORT POST-NOTIFICATION TOAST POPUP */}
      {notification && notification.show && (
        <div className="fixed bottom-6 right-6 z-50 p-5 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-2xl flex flex-col gap-3 max-w-sm animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                {notification.type === 'excel' ? 'Excel Raporu Oluşturuldu' : 'JSON Raporu Oluşturuldu'}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono break-all leading-normal">
                Konum: {notification.path}
              </p>
            </div>
            <button
              onClick={() => setNotification({ ...notification, show: false })}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm font-bold font-mono cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={async () => {
                await window.api.openPath(notification.path)
              }}
              className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-white text-[10px] font-bold text-center transition cursor-pointer"
            >
              Dosyayı Aç
            </button>
            <button
              onClick={async () => {
                await window.api.showItemInFolder(notification.path)
              }}
              className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 text-[10px] font-bold text-center transition cursor-pointer"
            >
              Klasörde Göster
            </button>
            <button
              onClick={() => {
                window.api.clipboardWriteText(notification.path)
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 text-[10px] font-bold text-center transition cursor-pointer"
              title="Dosya Yolunu Kopyala"
            >
              <Copy size={11} />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
