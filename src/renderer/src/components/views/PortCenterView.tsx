import React, { useState, useEffect } from 'react'
import { Radio, RefreshCw } from 'lucide-react'

interface PortCenterViewProps {
  connectionId: number | string
}

interface PortItem {
  protocol: string
  localAddress: string
  port: number
  processName: string
  pid: string
}

export const PortCenterView: React.FC<PortCenterViewProps> = ({ connectionId }) => {
  const [ports, setPorts] = useState<PortItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    loadPorts()
  }, [connectionId])

  const loadPorts = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      // Run ss -tulpn or netstat
      const cmd = 'sudo ss -tulpn || ss -tulpn || netstat -tulpn'
      const res = await window.api.sshExec(connectionId, cmd)
      if (res.error) {
        setError(res.error)
      } else {
        setPorts(parsePorts(res.stdout))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const parsePorts = (stdout: string): PortItem[] => {
    const lines = stdout.split('\n')
    const list: PortItem[] = []

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('Netid') || trimmed.startsWith('Active')) return

      // Format of ss -tulpn:
      // Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
      // tcp   LISTEN 0      128    0.0.0.0:80         0.0.0.0:*         users:(("nginx",pid=840,fd=6))
      const parts = trimmed.replace(/\s+/g, ' ').split(' ')
      if (parts.length < 5) return

      const protocol = parts[0].toUpperCase()
      const localAddrPort = parts[4] // e.g. 0.0.0.0:80 or [::]:80 or *:80 or 127.0.0.53%lo:53

      // Split address and port (last colon separates address from port)
      const lastColonIdx = localAddrPort.lastIndexOf(':')
      if (lastColonIdx === -1) return

      const localAddress = localAddrPort.substring(0, lastColonIdx)
      const portStr = localAddrPort.substring(lastColonIdx + 1)
      const port = parseInt(portStr) || 0

      // Extract process name and PID
      let processName = '-'
      let pid = '-'

      const usersMatch = trimmed.match(/users:\(\("([^"]+)",pid=(\d+)/)
      const slashMatch = trimmed.match(/(\d+)\/([^\s/:\(\)]+)/)

      if (usersMatch) {
        processName = usersMatch[1]
        pid = usersMatch[2]
      } else if (slashMatch) {
        pid = slashMatch[1]
        processName = slashMatch[2]
      } else {
        const pidMatch = trimmed.match(/pid=(\d+)/)
        if (pidMatch) pid = pidMatch[1]
        const nameMatch = trimmed.match(/"([^"]+)"/)
        if (nameMatch) processName = nameMatch[1]
      }

      list.push({
        protocol,
        localAddress,
        port,
        processName,
        pid
      })
    })

    // Sort by port number ascending
    return list.sort((a, b) => a.port - b.port)
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await loadPorts()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-slate-500">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <span className="text-sm font-semibold">Aktif portlar yükleniyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-red-500">
        <h3 className="text-lg font-bold mb-2">Port Analiz Hatası</h3>
        <p className="text-sm max-w-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={loadPorts}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-550 text-white transition"
        >
          Yeniden Dene
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-8 select-none">
      {/* Title / Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Aktif Dinleme Portları</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sunucuda TCP ve UDP üzerinden bağlantı kabul eden (LISTEN) tüm aktif portlar ve bunları kullanan süreçler.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className={`p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition ${
            refreshing ? 'animate-spin' : ''
          }`}
          title="Yenile"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {ports.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/40">
          <Radio size={48} className="text-slate-350 dark:text-slate-700 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-400 dark:text-slate-600 mb-1">Port Bulunamadı</h3>
          <p className="text-slate-400 dark:text-slate-600 text-xs text-center max-w-sm">
            Sunucuda herhangi bir dinleme portu bulunamadı veya komut çıktısı alınamadı.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
          {/* Header */}
          <div className="grid grid-cols-12 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <div className="col-span-2">Protokol</div>
            <div className="col-span-2 text-right">Port</div>
            <div className="col-span-3">Adres</div>
            <div className="col-span-3">Süreç (Process)</div>
            <div className="col-span-2 text-right">PID</div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {ports.map((p, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 px-4 py-3 text-xs font-semibold items-center hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
              >
                <div className="col-span-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      p.protocol === 'TCP'
                        ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-450'
                        : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'
                    }`}
                  >
                    {p.protocol}
                  </span>
                </div>

                <div className="col-span-2 text-right font-mono font-extrabold text-slate-800 dark:text-slate-200">
                  {p.port}
                </div>

                <div className="col-span-3 font-mono text-slate-500 truncate pr-4" title={p.localAddress}>
                  {p.localAddress}
                </div>

                <div className="col-span-3 text-slate-800 dark:text-slate-200 truncate uppercase tracking-wider font-extrabold">
                  {p.processName}
                </div>

                <div className="col-span-2 text-right font-mono text-slate-400">
                  {p.pid !== '-' ? `#${p.pid}` : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
