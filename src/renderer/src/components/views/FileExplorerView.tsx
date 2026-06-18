import React, { useState, useEffect } from 'react'
import {
  Folder,
  File,
  ArrowUp,
  FolderPlus,
  FilePlus,
  Trash2,
  Bookmark,
  RefreshCw,
  X,
  Save,
  FileCode,
  Upload,
  Download,
  FolderUp,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react'
import Editor from '@monaco-editor/react'

interface FileExplorerViewProps {
  connectionId: number | string
  initialPath?: string
}

interface FileItem {
  name: string
  isDirectory: boolean
  size: number
  mtime: number
  permissions: number
}

interface TransferItem {
  id: string
  name: string
  localPath: string
  remotePath: string
  direction: 'upload' | 'download'
  status: 'queued' | 'transferring' | 'completed' | 'failed'
  progress: number
  size?: number
  error?: string
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  connectionId,
  initialPath = '/var/www'
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath)
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  // Edit file states
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null)
  const [editingFileContent, setEditingFileContent] = useState<string>('')
  const [savingFile, setSavingFile] = useState<boolean>(false)

  // Creation Modals
  const [showCreateModal, setShowCreateModal] = useState<'file' | 'dir' | null>(null)
  const [newItemName, setNewItemName] = useState<string>('')

  // Transfer states
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [showTransferPanel, setShowTransferPanel] = useState<boolean>(true)
  const [activeTransferTab, setActiveTransferTab] = useState<'all' | 'active' | 'success' | 'failed'>('active')

  const favoriteFolders = [
    { name: '/var/www', path: '/var/www' },
    { name: '/etc/nginx', path: '/etc/nginx' },
    { name: '/etc/systemd', path: '/etc/systemd' },
    { name: '/var/log', path: '/var/log' },
    { name: '/home', path: '/home' },
    { name: '/opt', path: '/opt' }
  ]

  useEffect(() => {
    loadDirectory(currentPath)
  }, [connectionId, currentPath])

  useEffect(() => {
    const unsubStatus = window.api.onTransferStatus((update) => {
      setTransfers((prev) => {
        const idx = prev.findIndex((t) => t.id === update.id)
        if (idx !== -1) {
          const next = [...prev]
          next[idx] = { ...next[idx], ...update }
          return next
        } else {
          return [update, ...prev]
        }
      })
    })

    const unsubRefresh = window.api.onRefreshDirectory(() => {
      // Check if remotePath folder matches our current path to refresh list
      loadDirectory(currentPath)
    })

    return () => {
      unsubStatus()
      unsubRefresh()
    }
  }, [connectionId, currentPath])

  const handleUpload = async (type: 'file' | 'folder'): Promise<void> => {
    try {
      const res = await window.api.sftpUploadDialog(connectionId, currentPath, type)
      if (res && 'error' in res && res.error !== 'Cancelled') {
        alert('Yükleme Hatası: ' + res.error)
      }
    } catch (e: any) {
      alert('Hata: ' + e.message)
    }
  }

  const handleDownloadItem = async (item: FileItem): Promise<void> => {
    const targetPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`
    try {
      const res = await window.api.sftpDownloadDialog(connectionId, targetPath, item.isDirectory)
      if (res && 'error' in res && res.error !== 'Cancelled') {
        alert('İndirme Hatası: ' + res.error)
      }
    } catch (e: any) {
      alert('Hata: ' + e.message)
    }
  }

  const getFilteredTransfers = (): TransferItem[] => {
    switch (activeTransferTab) {
      case 'active':
        return transfers.filter((t) => t.status === 'queued' || t.status === 'transferring')
      case 'success':
        return transfers.filter((t) => t.status === 'completed')
      case 'failed':
        return transfers.filter((t) => t.status === 'failed')
      default:
        return transfers
    }
  }

  const activeCount = transfers.filter((t) => t.status === 'queued' || t.status === 'transferring').length
  const successCount = transfers.filter((t) => t.status === 'completed').length
  const failedCount = transfers.filter((t) => t.status === 'failed').length

  const loadDirectory = async (path: string): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await window.api.sftpList(connectionId, path)
      if (res && 'error' in res) {
        setError(res.error)
      } else {
        // Sort: directories first, then files alphabetically
        const sorted = (res as FileItem[]).sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
        setFiles(sorted)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (path: string): void => {
    setCurrentPath(path)
  }

  const handleGoUp = (): void => {
    if (currentPath === '/' || currentPath === '') return
    const parts = currentPath.split('/')
    parts.pop()
    const parent = parts.join('/') || '/'
    setCurrentPath(parent)
  }

  const handleDoubleClick = (item: FileItem): void => {
    const targetPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`
    if (item.isDirectory) {
      handleNavigate(targetPath)
    } else {
      openFileForEdit(targetPath)
    }
  }

  const openFileForEdit = async (path: string): Promise<void> => {
    setLoading(true)
    try {
      const res = await window.api.sftpRead(connectionId, path)
      if (typeof res === 'object' && 'error' in res) {
        alert('Dosya okunamadı: ' + res.error)
      } else {
        setEditingFilePath(path)
        setEditingFileContent(res as string)
      }
    } catch (e: any) {
      alert('Hata: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFile = async (): Promise<void> => {
    if (!editingFilePath) return
    setSavingFile(true)
    try {
      const res = await window.api.sftpWrite(connectionId, editingFilePath, editingFileContent)
      if (res && typeof res === 'object' && 'error' in res) {
        alert('Dosya kaydedilemedi: ' + res.error)
      } else {
        alert('Dosya başarıyla kaydedildi.')
      }
    } catch (e: any) {
      alert('Kaydetme hatası: ' + e.message)
    } finally {
      setSavingFile(false)
    }
  }

  const handleCreateItem = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newItemName) return

    const targetPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`

    try {
      if (showCreateModal === 'dir') {
        const res = await window.api.sftpMkdir(connectionId, targetPath)
        if (res && typeof res === 'object' && 'error' in res) {
          alert('Klasör oluşturulamadı: ' + res.error)
        }
      } else {
        // write empty string to touch file
        const res = await window.api.sftpWrite(connectionId, targetPath, '')
        if (res && typeof res === 'object' && 'error' in res) {
          alert('Dosya oluşturulamadı: ' + res.error)
        }
      }
      setShowCreateModal(null)
      setNewItemName('')
      loadDirectory(currentPath)
    } catch (e: any) {
      alert('Hata: ' + e.message)
    }
  }

  const handleDeleteItem = async (item: FileItem): Promise<void> => {
    const targetPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`
    if (confirm(`"${item.name}" öğesini kalıcı olarak silmek istiyor musunuz?`)) {
      try {
        const res = await window.api.sftpDelete(connectionId, targetPath, item.isDirectory)
        if (res && typeof res === 'object' && 'error' in res) {
          alert('Silme işlemi başarısız: ' + res.error)
        } else {
          loadDirectory(currentPath)
        }
      } catch (e: any) {
        alert('Hata: ' + e.message)
      }
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Determine language for monaco editor
  const getEditorLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript'
      case 'ts':
      case 'tsx':
        return 'typescript'
      case 'html':
        return 'html'
      case 'css':
        return 'css'
      case 'json':
        return 'json'
      case 'md':
        return 'markdown'
      case 'py':
        return 'python'
      case 'php':
        return 'php'
      case 'yml':
      case 'yaml':
        return 'yaml'
      case 'sh':
        return 'shell'
      default:
        return 'plaintext'
    }
  }

  return (
    <div className="flex-1 flex bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden select-none">
      {/* 1. SIDEBAR FAVORITE PATHS */}
      <div className="w-56 bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 space-y-4 shrink-0 flex flex-col">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Bookmark size={14} />
          Hızlı Gezinti
        </h3>

        <div className="space-y-1 flex-1 overflow-y-auto">
          {favoriteFolders.map((fav) => {
            const isActive = currentPath === fav.path
            return (
              <button
                key={fav.path}
                onClick={() => handleNavigate(fav.path)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                  isActive
                    ? 'bg-slate-200 dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Folder size={14} />
                <span className="truncate">{fav.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. FILE GRID / EDITOR PANE */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {editingFilePath ? (
          // MONACO EDITOR CONTAINER
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 text-white">
            <div className="h-12 border-b border-slate-800 px-4 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <FileCode size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span className="truncate max-w-sm">{editingFilePath}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  <Save size={14} />
                  {savingFile ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button
                  onClick={() => setEditingFilePath(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Editörü Kapat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1">
              <Editor
                height="100%"
                language={getEditorLanguage(editingFilePath)}
                theme="vs-dark"
                value={editingFileContent}
                onChange={(val) => setEditingFileContent(val || '')}
                options={{
                  fontFamily: 'Consolas, monospace',
                  fontSize: 13,
                  minimap: { enabled: true },
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
                }}
              />
            </div>
          </div>
        ) : (
          // FILE MANAGER VIEW
          <>
            {/* Top Toolbar */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-950 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 w-full max-w-xl">
                <button
                  onClick={handleGoUp}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition shrink-0"
                  title="Üst Dizine Git"
                >
                  <ArrowUp size={16} />
                </button>

                <div className="w-full flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono select-text truncate">
                  <span className="text-slate-400 mr-1 select-none">Path:</span>
                  <input
                    type="text"
                    className="bg-transparent border-none outline-none w-full text-slate-700 dark:text-slate-300 font-mono"
                    value={currentPath}
                    onChange={(e) => setCurrentPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadDirectory(currentPath)
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleUpload('file')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition flex items-center gap-1.5 text-xs font-semibold"
                  title="Dosya Yükle"
                >
                  <Upload size={14} />
                  <span className="hidden sm:inline">Dosya Yükle</span>
                </button>
                <button
                  onClick={() => handleUpload('folder')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition flex items-center gap-1.5 text-xs font-semibold"
                  title="Klasör Yükle"
                >
                  <FolderUp size={14} />
                  <span className="hidden sm:inline">Klasör Yükle</span>
                </button>
                <button
                  onClick={() => setShowCreateModal('file')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
                  title="Yeni Dosya"
                >
                  <FilePlus size={16} />
                </button>
                <button
                  onClick={() => setShowCreateModal('dir')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
                  title="Yeni Klasör"
                >
                  <FolderPlus size={16} />
                </button>
                <button
                  onClick={() => loadDirectory(currentPath)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
                  title="Yenile"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            {/* Main File list */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw className="animate-spin mb-4" size={24} />
                  <span className="text-xs font-semibold">Klasör listeleniyor...</span>
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-red-500 px-6">
                  <span className="text-sm font-bold mb-2">Hata Oluştu</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-md">
                    {error}
                  </span>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <div className="col-span-6">Adı</div>
                    <div className="col-span-2 text-right">Boyut</div>
                    <div className="col-span-3 text-right">Son Değişiklik</div>
                    <div className="col-span-1 text-right"></div>
                  </div>

                  {files.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">Klasör Boş</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-900">
                      {files.map((item, index) => (
                        <div
                          key={index}
                          onDoubleClick={() => handleDoubleClick(item)}
                          className="grid grid-cols-12 px-4 py-3 text-xs font-semibold items-center hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition"
                        >
                          <div className="col-span-6 flex items-center gap-2.5 truncate pr-4">
                            {item.isDirectory ? (
                              <Folder className="text-indigo-650 dark:text-indigo-400 shrink-0" size={16} />
                            ) : (
                              <File className="text-slate-400 shrink-0" size={16} />
                            )}
                            <span className="truncate hover:underline" title={item.name}>
                              {item.name}
                            </span>
                          </div>

                          <div className="col-span-2 text-right text-slate-500">
                            {item.isDirectory ? '-' : formatSize(item.size)}
                          </div>

                          <div className="col-span-3 text-right text-slate-500 truncate">
                            {new Date(item.mtime).toLocaleString()}
                          </div>

                          <div className="col-span-1 text-right flex justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownloadItem(item)
                              }}
                              className="p-1 rounded text-slate-400 hover:text-emerald-500 transition"
                              title="İndir"
                            >
                              <Download size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteItem(item)
                              }}
                              className="p-1 rounded text-slate-400 hover:text-red-500 transition"
                              title="Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FileZilla-style Transfer Queue Panel */}
            {transfers.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col shrink-0 transition-all duration-350" style={{ height: showTransferPanel ? '240px' : '36px' }}>
                <div className="h-9 border-b border-slate-150 dark:border-slate-900 px-4 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowTransferPanel(!showTransferPanel)}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-250 transition-colors"
                    >
                      {showTransferPanel ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                      Dosya Transfer Sırası ({transfers.filter(t => t.status === 'queued' || t.status === 'transferring').length} Aktif)
                    </button>
                  </div>
                  
                  {showTransferPanel && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveTransferTab('active')}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide transition-colors ${activeTransferTab === 'active' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
                      >
                        Kuyruktakiler ({activeCount})
                      </button>
                      <button
                        onClick={() => setActiveTransferTab('success')}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide transition-colors ${activeTransferTab === 'success' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
                      >
                        Başarılı ({successCount})
                      </button>
                      <button
                        onClick={() => setActiveTransferTab('failed')}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide transition-colors ${activeTransferTab === 'failed' ? 'bg-red-650 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
                      >
                        Başarısız ({failedCount})
                      </button>
                      <button
                        onClick={() => setActiveTransferTab('all')}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide transition-colors ${activeTransferTab === 'all' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-900'}`}
                      >
                        Tümü ({transfers.length})
                      </button>
                      <button
                        onClick={() => setTransfers([])}
                        className="ml-2 px-2 py-0.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded text-[9px] font-black text-slate-500 hover:text-slate-850 dark:hover:text-slate-200 transition-colors"
                      >
                        Kayıtları Temizle
                      </button>
                    </div>
                  )}
                </div>

                {showTransferPanel && (
                  <div className="flex-grow overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900/60 bg-slate-50/50 dark:bg-slate-950/20">
                    {getFilteredTransfers().length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 font-bold select-none">
                        Bu grupta aktarım kaydı bulunmuyor.
                      </div>
                    ) : (
                      getFilteredTransfers().map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-6 py-2 text-[10px] font-semibold text-slate-650 dark:text-slate-400 hover:bg-slate-100/30 dark:hover:bg-slate-900/20">
                          <div className="flex items-center gap-2.5 w-1/3 min-w-0">
                            {t.direction === 'upload' ? (
                              <Upload size={12} className="text-blue-500 shrink-0" />
                            ) : (
                              <Download size={12} className="text-emerald-550 shrink-0" />
                            )}
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold" title={t.name}>{t.name}</span>
                          </div>

                          <div className="w-1/4 truncate font-mono text-[9px] text-slate-500 dark:text-slate-450" title={t.localPath}>
                            {t.localPath}
                          </div>

                          <div className="w-1/4 truncate font-mono text-[9px] text-slate-400 dark:text-slate-500" title={t.remotePath}>
                            {t.remotePath}
                          </div>

                          <div className="w-1/6 flex items-center justify-end gap-3 font-mono text-right shrink-0">
                            {t.status === 'transferring' ? (
                              <div className="flex items-center gap-2 w-full justify-end">
                                <span className="text-[9px] text-indigo-650 dark:text-indigo-400 font-bold">{t.progress}%</span>
                                <div className="w-12 bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                  <div className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-150" style={{ width: `${t.progress}%` }}></div>
                                </div>
                                <Loader2 size={10} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                              </div>
                            ) : t.status === 'completed' ? (
                              <span className="text-emerald-500 flex items-center gap-1 font-bold"><CheckCircle2 size={10} /> Başarılı</span>
                            ) : t.status === 'failed' ? (
                              <span className="text-red-500 flex items-center gap-1 font-bold" title={t.error || 'Bilinmeyen Hata'}><XCircle size={10} /> Hata</span>
                            ) : (
                              <span className="text-slate-400">Kuyrukta</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold mb-4">
              {showCreateModal === 'dir' ? 'Yeni Klasör Oluştur' : 'Yeni Dosya Oluştur'}
            </h3>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Adı
                </label>
                <input
                  type="text"
                  required
                  placeholder={showCreateModal === 'dir' ? 'Klasör adı' : 'Dosya adı.txt'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-550 text-white transition"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
