import React, { useState, useEffect } from 'react'
import { Plus, Server, Star, Trash2, Edit2, ShieldAlert, Eye, EyeOff, Search, Sparkles, X, ChevronRight } from 'lucide-react'
import { Connection } from '../../../preload/api'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.png'

interface HostListProps {
  onConnect: (conn: Connection) => void
  isUnlocked: boolean
  onUnlockSuccess: () => void
  onOpenLocalPCInfo: () => void
}

export const HostList: React.FC<HostListProps> = ({ onConnect, isUnlocked, onUnlockSuccess, onOpenLocalPCInfo }) => {
  const [hasMasterPass, setHasMasterPass] = useState<boolean>(true)
  const [masterPassword, setMasterPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [authError, setAuthError] = useState<string>('')

  // Connection list state
  const [connections, setConnections] = useState<Connection[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [editingConn, setEditingConn] = useState<Connection | null>(null)

  // Connection Form State
  const [connName, setConnName] = useState<string>('')
  const [connHost, setConnHost] = useState<string>('')
  const [connPort, setConnPort] = useState<number>(22)
  const [connUser, setConnUser] = useState<string>('')
  const [connAuthType, setConnAuthType] = useState<'password' | 'key'>('password')
  const [connPassword, setConnPassword] = useState<string>('')
  const [connPrivateKey, setConnPrivateKey] = useState<string>('')
  const [connFavorite, setConnFavorite] = useState<boolean>(false)
  const [showPasswordRaw, setShowPasswordRaw] = useState<boolean>(false)
  const [connProtocol, setConnProtocol] = useState<'ssh' | 'ftp'>('ssh')

  const handleProtocolChange = (proto: 'ssh' | 'ftp'): void => {
    setConnProtocol(proto)
    if (proto === 'ftp') {
      setConnPort(21)
      setConnAuthType('password')
    } else {
      setConnPort(22)
    }
  }

  // Load checks
  useEffect(() => {
    checkMasterPasswordState()
  }, [isUnlocked])

  const checkMasterPasswordState = async (): Promise<void> => {
    const hasPass = await window.api.hasMasterPassword()
    setHasMasterPass(hasPass)
    if (isUnlocked) {
      loadConnections()
    }
  }

  const loadConnections = async (): Promise<void> => {
    const res = await window.api.getConnections()
    if (res && 'error' in res) {
      setAuthError(res.error)
    } else {
      setConnections(res)
    }
  }

  const handleCreateMaster = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!masterPassword) {
      setAuthError('Ana şifre boş bırakılamaz.')
      return
    }
    if (masterPassword !== confirmPassword) {
      setAuthError('Şifreler uyuşmuyor.')
      return
    }
    const success = await window.api.setMasterPassword(masterPassword)
    if (success) {
      setAuthError('')
      onUnlockSuccess()
    } else {
      setAuthError('Ana şifre kaydedilemedi.')
    }
  }

  const handleUnlock = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const success = await window.api.unlock(masterPassword)
    if (success) {
      setAuthError('')
      onUnlockSuccess()
    } else {
      setAuthError('Hatalı ana şifre. Lütfen tekrar deneyin.')
    }
  }

  const handleAddOrEditConnection = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!connName || !connHost || !connUser) {
      alert('Lütfen zorunlu alanları doldurun.')
      return
    }

    const payload: Connection = {
      name: connName,
      host: connHost,
      port: connPort,
      username: connUser,
      auth_type: connAuthType,
      password: connAuthType === 'password' ? connPassword : '',
      private_key: connAuthType === 'key' ? connPrivateKey : '',
      favorite: connFavorite ? 1 : 0,
      protocol: connProtocol
    }

    if (editingConn && editingConn.id) {
      const res = await window.api.updateConnection(editingConn.id, payload)
      if (res && typeof res === 'object' && 'error' in res) {
        alert('Güncelleme hatası: ' + res.error)
      } else {
        setShowAddModal(false)
        setEditingConn(null)
        loadConnections()
      }
    } else {
      const res = await window.api.addConnection(payload)
      if (res && typeof res === 'object' && 'error' in res) {
        alert('Kaydetme hatası: ' + res.error)
      } else {
        setShowAddModal(false)
        loadConnections()
      }
    }

    // Reset Form
    resetForm()
  }

  const resetForm = (): void => {
    setConnName('')
    setConnHost('')
    setConnPort(22)
    setConnUser('')
    setConnAuthType('password')
    setConnPassword('')
    setConnPrivateKey('')
    setConnFavorite(false)
    setConnProtocol('ssh')
    setEditingConn(null)
  }

  const handleEditClick = (conn: Connection): void => {
    setEditingConn(conn)
    setConnName(conn.name)
    setConnHost(conn.host)
    setConnPort(conn.port)
    setConnUser(conn.username)
    setConnAuthType(conn.auth_type)
    setConnPassword(conn.password || '')
    setConnPrivateKey(conn.private_key || '')
    setConnFavorite(conn.favorite === 1)
    setConnProtocol(conn.protocol || 'ssh')
    setShowAddModal(true)
  }

  const handleDeleteClick = async (id: number): Promise<void> => {
    if (confirm('Bu sunucu bağlantısını silmek istediğinize emin misiniz?')) {
      await window.api.deleteConnection(id)
      loadConnections()
    }
  }

  const toggleFavorite = async (conn: Connection): Promise<void> => {
    if (!conn.id) return
    const updated: Connection = {
      ...conn,
      favorite: conn.favorite === 1 ? 0 : 1
    }
    await window.api.updateConnection(conn.id, updated)
    loadConnections()
  }

  // Filter connections by search
  const filteredConnections = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 1. MASTER PASSWORD SCREENS
  if (!isUnlocked) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white select-none relative overflow-hidden transition-colors duration-300">
        {/* Animated Background Lights */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 rounded-3xl bg-white/80 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 backdrop-blur-2xl shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-black/80 relative overflow-hidden transition-all duration-300"
        >
          {/* Subtle top border glow */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-indigo-500/40" />

          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Soft logo backing glow */}
              <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-xl opacity-60" />
              <img src={logo} className="relative w-24 h-24 object-contain select-none" alt="PROMHUB Logo" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-center mb-2 tracking-wide text-slate-900 dark:text-white">
            {hasMasterPass ? 'Şifre Kasası' : 'Master Şifre Belirle'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs text-center mb-8 leading-relaxed max-w-sm mx-auto">
            {hasMasterPass
              ? 'Bağlantı şifreleriniz AES-256 ile korunmaktadır. Kasayı açmak için şifrenizi girin.'
              : 'Verilerinizi cihazınızda güvenle şifrelemek için bir ana şifre oluşturun. Lütfen bu şifreyi unutmayın.'}
          </p>

          <form onSubmit={hasMasterPass ? handleUnlock : handleCreateMaster} className="space-y-5">
            <div>
              <label className="block text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-widest">
                Ana Şifre
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-300 shadow-inner dark:shadow-none"
                placeholder="••••••••••••"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
              />
            </div>

            {!hasMasterPass && (
              <div>
                <label className="block text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-widest">
                  Şifreyi Onayla
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-300 shadow-inner dark:shadow-none"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            <AnimatePresence mode="wait">
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="flex items-start gap-2.5 p-3.5 text-xs bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-xl"
                >
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold tracking-wide transition-all duration-300 shadow-lg shadow-indigo-500/20 text-white cursor-pointer"
            >
              {hasMasterPass ? 'Kasa Kilidini Aç' : 'Şifreyi Kaydet ve Başlat'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    )
  }

  // 2. MAIN CONNECTION LIST SCREEN
  return (
    <div className="flex-grow flex flex-col p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none relative transition-colors duration-300">
      {/* Animated subtle lights */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
            Sunucu Workspace
            <Sparkles size={20} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
            SSH bağlantılarınızı organize edin, terminal veya gelişmiş kontrol paneli üzerinden sunucunuzu yönetin.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenLocalPCInfo}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all duration-300 shadow-lg shadow-emerald-600/20 uppercase tracking-wider cursor-pointer"
          >
            <Sparkles size={16} strokeWidth={3} />
            Kendi PC Analizi
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all duration-300 shadow-lg shadow-indigo-600/20 uppercase tracking-wider cursor-pointer"
          >
            <Plus size={16} strokeWidth={3} />
            Yeni Bağlantı
          </motion.button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8 z-10">
        <Search className="absolute left-4 top-4 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Sunucu adı, IP adresi veya kullanıcı adı ile filtrele..."
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-300 backdrop-blur-sm shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Connections List */}
      {filteredConnections.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center p-16 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl bg-white/40 dark:bg-slate-900/10 backdrop-blur-sm relative z-10 shadow-inner">
          <Server size={54} className="text-slate-300 dark:text-slate-700 mb-4 animate-bounce" />
          <h3 className="text-lg font-bold mb-1.5 text-slate-500 dark:text-slate-400">Sunucu Bulunamadı</h3>
          <p className="text-slate-400 dark:text-slate-500 text-xs text-center max-w-xs leading-relaxed">
            {searchQuery ? 'Arama filtrenize uygun sunucu kaydı bulunamadı.' : 'Henüz sunucu eklememişsiniz. Yeni bağlantı ekleyerek başlayın.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {filteredConnections.map((conn) => (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6, scale: 1.015 }}
              transition={{ duration: 0.25 }}
              className={`group relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                conn.favorite
                  ? 'border-yellow-500/30 dark:border-yellow-500/20 bg-white dark:bg-slate-900/30 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/5'
                  : 'border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/20 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5'
              } backdrop-blur-md shadow-sm`}
            >
              {/* Star / Favorite Indicator */}
              <button
                onClick={() => toggleFavorite(conn)}
                className={`absolute top-5 right-5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-255 dark:border-slate-850 text-slate-400 dark:text-slate-500 hover:text-yellow-500 hover:scale-110 transition duration-200 ${
                  conn.favorite ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' : ''
                }`}
              >
                <Star size={14} fill={conn.favorite ? 'currentColor' : 'none'} />
              </button>

              <div className="flex items-center gap-4 mb-5">
                <div className={`p-3.5 rounded-xl ${conn.favorite ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20' : 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20'}`}>
                  <Server size={22} />
                </div>
                <div className="min-w-0 pr-8">
                  <h4 className="font-extrabold text-base text-slate-850 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white transition truncate" title={conn.name}>
                    {conn.name}
                  </h4>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-mono font-bold tracking-tight flex items-center gap-1.5 mt-0.5 truncate">
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                      {conn.protocol || 'ssh'}
                    </span>
                    <span className="truncate">{conn.username}@{conn.host}:{conn.port}</span>
                  </span>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between gap-4">
                <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">
                  {conn.last_connected
                    ? `Bağlantı: ${new Date(conn.last_connected).toLocaleDateString()}`
                    : 'Bağlantı Yok'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleEditClick(conn)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition duration-200"
                    title="Düzenle"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => conn.id && handleDeleteClick(conn.id)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition duration-200"
                    title="Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onConnect(conn)}
                    className="ml-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all duration-300 shadow-md shadow-indigo-600/10 flex items-center gap-1 cursor-pointer"
                  >
                    Bağlan
                    <ChevronRight size={14} strokeWidth={2.5} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 3. ADD / EDIT CONNECTION MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-2xl text-slate-900 dark:text-slate-100 relative max-h-[90vh] overflow-y-auto"
            >
              {/* Glowing header line */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-indigo-500/40" />

              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {editingConn ? 'Bağlantıyı Düzenle' : 'Yeni Sunucu Bağlantısı'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-205 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddOrEditConnection} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-widest">
                    Bağlantı Protokolü
                  </label>
                  
                  {/* Styled Protocol Selector Switch */}
                  <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-955/80 border border-slate-200 dark:border-slate-850/80">
                    <button
                      type="button"
                      onClick={() => handleProtocolChange('ssh')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 uppercase tracking-wider ${
                        connProtocol === 'ssh'
                          ? 'bg-indigo-650 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      SSH / SFTP
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProtocolChange('ftp')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 uppercase tracking-wider ${
                        connProtocol === 'ftp'
                          ? 'bg-indigo-650 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      FTP / FTPS
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                    Bağlantı İsmi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="örn. Live Backend Sunucusu"
                    className="w-full px-4.5 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-955/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-550/70 focus:ring-1 focus:ring-indigo-550/30 transition-all duration-300 shadow-sm"
                    value={connName}
                    onChange={(e) => setConnName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                      Sunucu Adresi (Host / IP)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="188.166.x.x veya app.sunucu.com"
                      className="w-full px-4.5 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-955/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-555/70 focus:ring-1 focus:ring-indigo-555/30 transition-all duration-300 shadow-sm"
                      value={connHost}
                      onChange={(e) => setConnHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                      Port
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full px-4.5 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-955/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-555/70 focus:ring-1 focus:ring-indigo-555/30 transition-all duration-300 font-mono shadow-sm"
                      value={connPort}
                      onChange={(e) => setConnPort(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                    Kullanıcı Adı (Username)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="root, ubuntu, deploy..."
                    className="w-full px-4.5 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-955/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-555/70 focus:ring-1 focus:ring-indigo-555/30 transition-all duration-300 shadow-sm"
                    value={connUser}
                    onChange={(e) => setConnUser(e.target.value)}
                  />
                </div>

                {connProtocol === 'ssh' && (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-widest">
                      Kimlik Doğrulama Yöntemi
                    </label>
                    
                    {/* Styled Switch Tab */}
                    <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-955/80 border border-slate-200 dark:border-slate-850/80">
                      <button
                        type="button"
                        onClick={() => setConnAuthType('password')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 uppercase tracking-wider ${
                          connAuthType === 'password'
                            ? 'bg-indigo-650 text-white shadow-md shadow-indigo-600/20'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Şifre
                      </button>
                      <button
                        type="button"
                        onClick={() => setConnAuthType('key')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 uppercase tracking-wider ${
                          connAuthType === 'key'
                            ? 'bg-indigo-650 text-white shadow-md shadow-indigo-600/20'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        SSH Anahtarı
                      </button>
                    </div>
                  </div>
                )}

                {connAuthType === 'password' ? (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                      Kullanıcı Şifresi (Password)
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordRaw ? 'text' : 'password'}
                        placeholder="Sunucu şifresi"
                        className="w-full px-4.5 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-955/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-555/70 focus:ring-1 focus:ring-indigo-555/30 transition-all duration-300 pr-12 font-mono shadow-sm"
                        value={connPassword}
                        onChange={(e) => setConnPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordRaw(!showPasswordRaw)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition duration-200"
                      >
                        {showPasswordRaw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                      Özel Anahtar İçeriği (Private Key PEM)
                    </label>
                    <textarea
                      placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEowIBAAKCAQEA..."
                      className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-955/60 text-xs font-mono focus:outline-none focus:border-indigo-555/70 focus:ring-1 focus:ring-indigo-555/30 transition-all duration-300 resize-none shadow-sm"
                      value={connPrivateKey}
                      onChange={(e) => setConnPrivateKey(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 py-2">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      id="favorite_check"
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900 focus:ring-1 text-indigo-650 cursor-pointer"
                      checked={connFavorite}
                      onChange={(e) => setConnFavorite(e.target.checked)}
                    />
                  </div>
                  <label htmlFor="favorite_check" className="text-xs font-semibold text-slate-600 dark:text-slate-350 cursor-pointer select-none">
                    Bu sunucuyu sık kullanılanlara ekle
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-900 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-600 dark:text-slate-450 hover:bg-slate-200 dark:hover:bg-slate-850 transition duration-200"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/10 transition duration-200 cursor-pointer"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
