import React, { useState, useEffect } from 'react'
import { Database, Play, Square, RotateCw, RefreshCw } from 'lucide-react'

interface DockerCenterViewProps {
  connectionId: number | string
}

interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  ports: string
  isRunning: boolean
}

export const DockerCenterView: React.FC<DockerCenterViewProps> = ({ connectionId }) => {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null) // container name/id

  useEffect(() => {
    loadContainers()
  }, [connectionId])

  const loadContainers = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const cmd = `
        if command -v docker >/dev/null 2>&1; then
          docker ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","ports":"{{.Ports}}"}'
        else
          echo "DOCKER_NOT_INSTALLED"
        fi
      `
      const res = await window.api.sshExec(connectionId, cmd)
      if (res.error) {
        setError(res.error)
      } else if (res.stdout.includes('DOCKER_NOT_INSTALLED')) {
        setError('Docker bu sunucuda kurulu değil veya çalışmıyor.')
      } else {
        setContainers(parseContainers(res.stdout))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const parseContainers = (stdout: string): DockerContainer[] => {
    const lines = stdout.trim().split('\n')
    const list: DockerContainer[] = []

    lines.forEach((line) => {
      if (!line.trim()) return
      try {
        const item = JSON.parse(line)
        const status = item.status || ''
        const isRunning = status.toLowerCase().startsWith('up')

        list.push({
          id: item.id,
          name: item.name,
          image: item.image,
          status: status,
          ports: item.ports || '-',
          isRunning
        })
      } catch (e) {
        // ignore malformed JSON lines
      }
    })

    return list
  }

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    setActionLoading(id)
    try {
      const cmd = `docker ${action} ${id}`
      const res = await window.api.sshExec(connectionId, cmd)
      if (res.code !== 0) {
        alert(`Docker işlemi başarısız oldu:\n${res.stderr || res.stdout}`)
      } else {
        await loadContainers()
      }
    } catch (e: any) {
      alert('Hata: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await loadContainers()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-slate-500">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <span className="text-sm font-semibold">Docker konteynerleri listeleniyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-red-500">
        <h3 className="text-lg font-bold mb-2">Docker Veri Hatası</h3>
        <p className="text-sm max-w-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={loadContainers}
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
          <h2 className="text-2xl font-bold tracking-tight">Docker Konteyner Merkezi</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sunucudaki aktif ve pasif Docker konteynerlerini görüntüleyin ve yönetin.
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

      {containers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/40">
          <Database size={48} className="text-slate-350 dark:text-slate-700 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-400 dark:text-slate-600 mb-1">Konteyner Bulunamadı</h3>
          <p className="text-slate-400 dark:text-slate-600 text-xs text-center max-w-sm">
            Docker kurulu ve çalışıyor fakat herhangi bir konteyner oluşturulmamış.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
          {/* Header */}
          <div className="grid grid-cols-12 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <div className="col-span-1">ID</div>
            <div className="col-span-3">Konteyner Adı</div>
            <div className="col-span-3">Image</div>
            <div className="col-span-2">Durum</div>
            <div className="col-span-1 text-right">Portlar</div>
            <div className="col-span-2 text-right">İşlemler</div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {containers.map((c) => {
              const isProcessing = actionLoading === c.id

              return (
                <div
                  key={c.id}
                  className="grid grid-cols-12 px-4 py-3.5 text-xs font-semibold items-center hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                >
                  <div className="col-span-1 text-slate-400 font-mono">{c.id}</div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Database size={14} className={c.isRunning ? 'text-indigo-500' : 'text-slate-400'} />
                    <span className="truncate uppercase tracking-wide font-extrabold text-slate-800 dark:text-slate-200" title={c.name}>
                      {c.name}
                    </span>
                  </div>

                  <div className="col-span-3 text-slate-500 truncate pr-4 font-mono text-[11px]" title={c.image}>
                    {c.image}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        c.isRunning
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}
                    >
                      {c.isRunning ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>

                  <div className="col-span-1 text-right text-slate-500 truncate font-mono text-[10px]" title={c.ports}>
                    {c.ports}
                  </div>

                  {/* Action buttons */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    {c.isRunning ? (
                      <button
                        onClick={() => handleAction(c.id, 'stop')}
                        disabled={isProcessing}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition disabled:opacity-50"
                        title="Durdur"
                      >
                        <Square size={13} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(c.id, 'start')}
                        disabled={isProcessing}
                        className="p-1.5 rounded hover:bg-green-500/10 text-green-500 transition disabled:opacity-50"
                        title="Başlat"
                      >
                        <Play size={13} fill="currentColor" />
                      </button>
                    )}

                    <button
                      onClick={() => handleAction(c.id, 'restart')}
                      disabled={isProcessing}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:hover:text-slate-300 transition disabled:opacity-50"
                      title="Yeniden Başlat"
                    >
                      <RotateCw size={13} />
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
