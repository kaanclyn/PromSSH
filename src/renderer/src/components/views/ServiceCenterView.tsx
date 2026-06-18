import React, { useState, useEffect } from 'react'
import { Settings, Play, Square, RotateCw, RefreshCw, AlertCircle } from 'lucide-react'

interface ServiceCenterViewProps {
  connectionId: number | string
}

interface ServiceStatus {
  name: string
  state: 'active' | 'inactive' | 'failed' | string
  enabled: 'enabled' | 'disabled' | string
}

export const ServiceCenterView: React.FC<ServiceCenterViewProps> = ({ connectionId }) => {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null) // serviceName

  const serviceList = ['nginx', 'apache2', 'mysql', 'postgresql', 'docker', 'redis-server', 'pm2']

  useEffect(() => {
    loadServices()
  }, [connectionId])

  const loadServices = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const script = `
        for svc in ${serviceList.join(' ')}; do
          # Check if service exists
          if systemctl list-unit-files --type=service | grep -q "^$\{svc\}.service" || systemctl list-units --type=service --all | grep -q " $\{svc\}.service"; then
            state=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
            enabled=$(systemctl is-enabled "$svc" 2>/dev/null || echo "disabled")
            echo "===SERVICE==="
            echo "name: $svc"
            echo "state: $state"
            echo "enabled: $enabled"
          fi
        done
      `
      const res = await window.api.sshExec(connectionId, script)
      if (res.error) {
        setError(res.error)
      } else {
        setServices(parseServices(res.stdout))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const parseServices = (stdout: string): ServiceStatus[] => {
    const blocks = stdout.split('===SERVICE===')
    const list: ServiceStatus[] = []

    blocks.forEach((block) => {
      if (!block.trim()) return

      const lines = block.split('\n')
      let name = ''
      let state = 'inactive'
      let enabled = 'disabled'

      lines.forEach((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('name: ')) name = trimmed.replace('name: ', '')
        if (trimmed.startsWith('state: ')) state = trimmed.replace('state: ', '')
        if (trimmed.startsWith('enabled: ')) enabled = trimmed.replace('enabled: ', '')
      })

      if (name) {
        list.push({ name, state, enabled })
      }
    })

    return list
  }

  const handleAction = async (serviceName: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    setActionLoading(serviceName)
    try {
      // Use sudo -n to run without asking password if passwordless sudo is configured, otherwise fallback to systemctl
      const cmd = `sudo systemctl ${action} ${serviceName} || systemctl ${action} ${serviceName}`
      const res = await window.api.sshExec(connectionId, cmd)
      if (res.code !== 0) {
        alert(`İşlem başarısız oldu:\n${res.stderr || res.stdout}`)
      } else {
        // reload list
        const loadScript = `
          state=$(systemctl is-active "${serviceName}" 2>/dev/null || echo "inactive")
          enabled=$(systemctl is-enabled "${serviceName}" 2>/dev/null || echo "disabled")
          echo "state: $state"
          echo "enabled: $enabled"
        `
        const loadRes = await window.api.sshExec(connectionId, loadScript)
        if (!loadRes.error) {
          const lines = loadRes.stdout.split('\n')
          let newState = 'inactive'
          let newEnabled = 'disabled'
          lines.forEach((l) => {
            if (l.trim().startsWith('state: ')) newState = l.replace('state: ', '').trim()
            if (l.trim().startsWith('enabled: ')) newEnabled = l.replace('enabled: ', '').trim()
          })

          setServices((prev) =>
            prev.map((s) =>
              s.name === serviceName ? { ...s, state: newState, enabled: newEnabled } : s
            )
          )
        }
      }
    } catch (e: any) {
      alert('Hata: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await loadServices()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-slate-500">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <span className="text-sm font-semibold">Servisler yükleniyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-red-500">
        <h3 className="text-lg font-bold mb-2">Servis Yükleme Hatası</h3>
        <p className="text-sm max-w-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={loadServices}
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
          <h2 className="text-2xl font-bold tracking-tight">Servis Yönetim Merkezi</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Systemd servislerini başlatın, durdurun veya yeniden başlatın. (Bazı işlemler root/sudo yetkisi gerektirebilir).
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

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/40">
          <Settings size={48} className="text-slate-350 dark:text-slate-700 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-400 dark:text-slate-600 mb-1">Hiç Servis Bulunamadı</h3>
          <p className="text-slate-400 dark:text-slate-600 text-xs text-center max-w-sm">
            Desteklenen popüler servislerin (Nginx, Apache, MySQL, Docker vb.) hiçbiri bu sunucuda bulunamadı.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc) => {
            const isActive = svc.state === 'active'
            const isFailed = svc.state === 'failed'
            const isProcessing = actionLoading === svc.name

            return (
              <div
                key={svc.name}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:shadow-lg transition flex flex-col"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
                      <Settings size={22} className={isActive ? 'animate-spin-slow' : ''} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base uppercase">{svc.name}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Kayıt: {svc.enabled}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                      isActive
                        ? 'bg-green-500/10 text-green-500'
                        : isFailed
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
                    }`}
                  >
                    {isFailed && <AlertCircle size={10} />}
                    {svc.state}
                  </span>
                </div>

                {/* Actions Grid */}
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 w-full">
                    {isActive ? (
                      <button
                        onClick={() => handleAction(svc.name, 'stop')}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold transition disabled:opacity-50"
                      >
                        <Square size={12} fill="currentColor" />
                        Durdur
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(svc.name, 'start')}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-500 text-xs font-bold transition disabled:opacity-50"
                      >
                        <Play size={12} fill="currentColor" />
                        Başlat
                      </button>
                    )}

                    <button
                      onClick={() => handleAction(svc.name, 'restart')}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold transition disabled:opacity-50"
                    >
                      <RotateCw size={12} />
                      Yeniden Başlat
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
