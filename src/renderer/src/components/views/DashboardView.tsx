import React, { useState, useEffect } from 'react'
import { Activity, HardDrive, Cpu, Layers, RefreshCw, Clock, Globe } from 'lucide-react'

interface DashboardViewProps {
  connectionId: number | string
}

interface SystemMetrics {
  hostname: string
  os: string
  kernel: string
  uptime: string
  cpuUsage: number // percentage
  cpuModel: string
  ramTotal: number // MB
  ramUsed: number // MB
  ramUsage: number // percentage
  diskTotal: string
  diskUsed: string
  diskUsage: number // percentage
  diskMount: string
  ipAddress: string
}

export const DashboardView: React.FC<DashboardViewProps> = ({ connectionId }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchMetrics()
    // Poll metrics every 6 seconds to update CPU/RAM usage dynamically
    const interval = setInterval(fetchMetricsSilent, 6000)
    return () => clearInterval(interval)
  }, [connectionId])

  const fetchMetricsSilent = async (): Promise<void> => {
    try {
      const res = await window.api.sshExec(
        connectionId,
        `
        # 1. Hostname
        hostname;
        echo "---"
        # 2. OS Info
        if [ -f /etc/os-release ]; then
          cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"'
        else
          uname -s
        fi;
        echo "---"
        # 3. Kernel
        uname -r;
        echo "---"
        # 4. Uptime
        uptime -p || uptime;
        echo "---"
        # 5. CPU Model
        cat /proc/cpuinfo | grep 'model name' | head -n 1 | cut -d: -f2 || echo "Generic CPU"
        echo "---"
        # 6. CPU Usage
        top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
        echo "---"
        # 7. Memory (free -m)
        free -m;
        echo "---"
        # 8. Disk (df -h /)
        df -h / | tail -n 1
        echo "---"
        # 9. Local IP
        hostname -I | awk '{print $1}' || echo "N/A"
        `
      )

      if (res.error) {
        return
      }

      const parsed = parseMetricsString(res.stdout)
      setMetrics((prev) => {
        if (!prev) return parsed
        return {
          ...parsed,
          // Keep static info if parsing failed in this quick check
          cpuModel: parsed.cpuModel || prev.cpuModel,
          hostname: parsed.hostname || prev.hostname,
          os: parsed.os || prev.os,
          kernel: parsed.kernel || prev.kernel
        }
      })
    } catch (e) {
      // ignore silent errors
    }
  }

  const fetchMetrics = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await window.api.sshExec(
        connectionId,
        `
        hostname;
        echo "---"
        if [ -f /etc/os-release ]; then
          cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"'
        else
          uname -s
        fi;
        echo "---"
        uname -r;
        echo "---"
        uptime -p || uptime;
        echo "---"
        cat /proc/cpuinfo | grep 'model name' | head -n 1 | cut -d: -f2 || echo "Generic CPU"
        echo "---"
        top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
        echo "---"
        free -m;
        echo "---"
        df -h / | tail -n 1
        echo "---"
        hostname -I | awk '{print $1}' || echo "N/A"
        `
      )

      if (res.error) {
        setError(res.error)
      } else {
        const parsed = parseMetricsString(res.stdout)
        setMetrics(parsed)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const parseMetricsString = (stdout: string): SystemMetrics => {
    const blocks = stdout.split('---').map((b) => b.trim())

    const hostname = blocks[0] || 'Unknown'
    const os = blocks[1] || 'Linux'
    const kernel = blocks[2] || 'Unknown'
    const uptime = blocks[3] || 'Unknown'
    const cpuModel = (blocks[4] || 'Generic CPU').trim()
    const cpuUsage = Math.min(100, Math.max(0, parseFloat(blocks[5]) || 0))

    // Parse Memory block
    const ramLines = (blocks[6] || '').split('\n')
    let ramTotal = 16384
    let ramUsed = 2048
    let ramUsage = 12

    const memLine = ramLines.find((l) => l.toLowerCase().startsWith('mem:'))
    if (memLine) {
      const parts = memLine.replace(/\s+/g, ' ').split(' ')
      // free -m columns: Mem: total used free shared buff/cache available
      ramTotal = parseInt(parts[1]) || 16384
      ramUsed = parseInt(parts[2]) || 2048
      ramUsage = Math.round((ramUsed / ramTotal) * 100)
    }

    // Parse Disk block (df -h /)
    const diskLine = blocks[7] || ''
    // df columns: Filesystem Size Used Avail Use% MountedOn
    const diskParts = diskLine.replace(/\s+/g, ' ').split(' ')
    const diskTotal = diskParts[1] || 'N/A'
    const diskUsed = diskParts[2] || 'N/A'
    const diskUsageStr = diskParts[4] ? diskParts[4].replace('%', '') : '0'
    const diskUsage = parseInt(diskUsageStr) || 0
    const diskMount = diskParts[5] || '/'

    const ipAddress = blocks[8] || 'N/A'

    return {
      hostname,
      os,
      kernel,
      uptime,
      cpuUsage: Math.round(cpuUsage),
      cpuModel,
      ramTotal,
      ramUsed,
      ramUsage,
      diskTotal,
      diskUsed,
      diskUsage,
      diskMount,
      ipAddress
    }
  }

  const handleManualRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await fetchMetrics()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-slate-500">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <span className="text-sm font-semibold">Sunucu verileri toplanıyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-red-500">
        <h3 className="text-lg font-bold mb-2">Sunucu Analiz Hatası</h3>
        <p className="text-sm max-w-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-550 text-white transition"
        >
          Yeniden Dene
        </button>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-8 select-none">
      {/* Title / Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sunucu Özeti</h2>
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            {metrics.hostname} &bull; {metrics.ipAddress}
          </span>
        </div>

        <button
          onClick={handleManualRefresh}
          className={`p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition ${
            refreshing ? 'animate-spin' : ''
          }`}
          title="Yenile"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Basic Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* OS Card */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
              İşletim Sistemi
            </span>
            <span className="font-bold text-sm line-clamp-1">{metrics.os}</span>
            <span className="text-[10px] text-slate-400 block truncate">{metrics.kernel}</span>
          </div>
        </div>

        {/* Uptime Card */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500 shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Çalışma Süresi (Uptime)
            </span>
            <span className="font-bold text-sm block line-clamp-1">{metrics.uptime}</span>
          </div>
        </div>

        {/* CPU Model Card */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
            <Cpu size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              CPU Donanımı
            </span>
            <span className="font-bold text-sm block truncate" title={metrics.cpuModel}>
              {metrics.cpuModel}
            </span>
          </div>
        </div>

        {/* IP Card */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-500 shrink-0">
            <Globe size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Yerel IP Adresi
            </span>
            <span className="font-bold text-sm block">{metrics.ipAddress}</span>
          </div>
        </div>
      </div>

      {/* Metrics Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Card */}
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Activity className="text-indigo-500" size={16} />
              CPU Kullanımı
            </h4>
            <span className="text-sm font-extrabold text-indigo-650 dark:text-indigo-400">{metrics.cpuUsage}%</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-550 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.cpuUsage}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 block font-semibold">
            Sunucu üzerindeki aktif işlemci yükü
          </span>
        </div>

        {/* Memory Card */}
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Layers className="text-purple-500" size={16} />
              RAM Bellek
            </h4>
            <span className="text-sm font-extrabold text-purple-500">{metrics.ramUsage}%</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.ramUsage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Kullanılan: {metrics.ramUsed} MB</span>
            <span>Toplam: {metrics.ramTotal} MB</span>
          </div>
        </div>

        {/* Disk Card */}
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <HardDrive className="text-green-500" size={16} />
              Disk Depolama ({metrics.diskMount})
            </h4>
            <span className="text-sm font-extrabold text-green-500">{metrics.diskUsage}%</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-green-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.diskUsage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Dolu: {metrics.diskUsed}</span>
            <span>Kapasite: {metrics.diskTotal}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
