import React, { useState, useEffect } from 'react'
import { Zap, Play, Square, RotateCw, Trash2, RefreshCw } from 'lucide-react'

interface PM2CenterViewProps {
  connectionId: number | string
}

interface PM2Process {
  id: number
  name: string
  status: 'online' | 'stopped' | 'errored' | string
  cpu: number
  memory: number // bytes
  restarts: number
  uptime: string
}

export const PM2CenterView: React.FC<PM2CenterViewProps> = ({ connectionId }) => {
  const [processes, setProcesses] = useState<PM2Process[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<number | null>(null) // process pm_id

  useEffect(() => {
    loadProcesses()
  }, [connectionId])

  const loadProcesses = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      // Execute pm2 jlist or fallback path
      const cmd = 'pm2 jlist || ~/.nvm/versions/node/$(node -v)/bin/pm2 jlist || usr/bin/pm2 jlist'
      const res = await window.api.sshExec(connectionId, cmd)
      if (res.error) {
        setError(res.error)
      } else {
        try {
          const parsed = parsePM2Json(res.stdout)
          setProcesses(parsed)
        } catch (e: any) {
          setError('PM2 verisi okunamadı: ' + e.message + '\nÇıktı:\n' + res.stdout)
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const parsePM2Json = (stdout: string): PM2Process[] => {
    // Find json block (pm2 warnings or info logs might precede or succeed the array)
    const startIdx = stdout.indexOf('[')
    const endIdx = stdout.lastIndexOf(']')

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      throw new Error('Geçerli bir JSON dizisi bulunamadı.')
    }

    const jsonStr = stdout.substring(startIdx, endIdx + 1)
    const rawList = JSON.parse(jsonStr) as any[]

    return rawList.map((proc) => {
      const pm_id = proc.pm_id
      const name = proc.name || 'app'
      const status = proc.pm2_env?.status || 'stopped'
      const cpu = proc.monit?.cpu || 0
      const memory = proc.monit?.memory || 0
      const restarts = proc.pm2_env?.restart_time || 0

      // Calculate uptime
      let uptimeStr = '-'
      if (proc.pm2_env?.pm_uptime && status === 'online') {
        const diffMs = Date.now() - proc.pm2_env.pm_uptime
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        uptimeStr = diffHrs > 0 ? `${diffHrs}sa ${diffMins}dk` : `${diffMins}dk`
      }

      return {
        id: pm_id,
        name,
        status,
        cpu,
        memory,
        restarts,
        uptime: uptimeStr
      }
    })
  }

  const handleAction = async (id: number, action: 'restart' | 'stop' | 'delete'): Promise<void> => {
    setActionLoading(id)
    try {
      const cmd = `pm2 ${action} ${id}`
      const res = await window.api.sshExec(connectionId, cmd)
      if (res.code !== 0) {
        alert(`PM2 işlemi başarısız oldu:\n${res.stderr || res.stdout}`)
      } else {
        await loadProcesses()
      }
    } catch (e: any) {
      alert('Hata: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await loadProcesses()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-slate-500">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <span className="text-sm font-semibold">PM2 süreçleri listeleniyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-red-500">
        <h3 className="text-lg font-bold mb-2">PM2 Veri Hatası</h3>
        <p className="text-sm max-w-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 mb-6 whitespace-pre-line">
          {error}
        </p>
        <button
          onClick={loadProcesses}
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
          <h2 className="text-2xl font-bold tracking-tight">PM2 İşlem Yöneticisi</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sunucu üzerindeki Node.js süreçlerini (PM2) anlık izleyin ve yönetin.
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

      {processes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/40">
          <Zap size={48} className="text-slate-350 dark:text-slate-700 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-400 dark:text-slate-600 mb-1">Hiç PM2 Süreci Bulunamadı</h3>
          <p className="text-slate-400 dark:text-slate-600 text-xs text-center max-w-sm">
            PM2 aktif olarak çalışıyor fakat listelenmiş bir Node.js süreci bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
          {/* Header */}
          <div className="grid grid-cols-12 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <div className="col-span-1">ID</div>
            <div className="col-span-3">Uygulama Adı</div>
            <div className="col-span-2">Durum</div>
            <div className="col-span-1 text-right">CPU</div>
            <div className="col-span-1 text-right">Bellek</div>
            <div className="col-span-1 text-right">Restart</div>
            <div className="col-span-1 text-right">Uptime</div>
            <div className="col-span-2 text-right">İşlemler</div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {processes.map((p) => {
              const isOnline = p.status === 'online'
              const isProcessing = actionLoading === p.id

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-12 px-4 py-3.5 text-xs font-semibold items-center hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                >
                  <div className="col-span-1 text-slate-400 font-mono">#{p.id}</div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Zap size={14} className={isOnline ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-450 dark:text-slate-500'} />
                    <span className="truncate uppercase tracking-wide font-extrabold text-slate-800 dark:text-slate-200">
                      {p.name}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        isOnline
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div className="col-span-1 text-right font-mono font-bold text-slate-600 dark:text-slate-450">
                    {p.cpu}%
                  </div>

                  <div className="col-span-1 text-right font-mono font-bold text-slate-600 dark:text-slate-450">
                    {formatMemory(p.memory)}
                  </div>

                  <div className="col-span-1 text-right font-mono text-slate-500">{p.restarts}</div>

                  <div className="col-span-1 text-right text-slate-500">{p.uptime}</div>

                  {/* Action buttons */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    {isOnline ? (
                      <button
                        onClick={() => handleAction(p.id, 'stop')}
                        disabled={isProcessing}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition disabled:opacity-50"
                        title="Durdur"
                      >
                        <Square size={13} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(p.id, 'restart')}
                        disabled={isProcessing}
                        className="p-1.5 rounded hover:bg-green-500/10 text-green-500 transition disabled:opacity-50"
                        title="Başlat"
                      >
                        <Play size={13} fill="currentColor" />
                      </button>
                    )}

                    <button
                      onClick={() => handleAction(p.id, 'restart')}
                      disabled={isProcessing}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:hover:text-slate-300 transition disabled:opacity-50"
                      title="Yeniden Başlat"
                    >
                      <RotateCw size={13} />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`"${p.name}" uygulamasını PM2'den silmek istediğinize emin misiniz?`)) {
                          handleAction(p.id, 'delete')
                        }
                      }}
                      disabled={isProcessing}
                      className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition disabled:opacity-50"
                      title="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
