import { Shield, Power, Sun, Moon, Wifi, WifiOff, Info } from 'lucide-react'
import logo from '../assets/logo.png'

interface TitlebarProps {
  activeHostName?: string
  isUnlocked: boolean
  onLock?: () => void
  onDisconnect?: () => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
  latency?: number
  onOpenInfo: () => void
}

export const Titlebar: React.FC<TitlebarProps> = ({
  activeHostName,
  isUnlocked,
  onLock,
  onDisconnect,
  theme,
  toggleTheme,
  latency,
  onOpenInfo
}) => {
  const handleMinimize = (): void => {
    window.api.minimize()
  }

  const handleMaximize = (): void => {
    window.api.maximize()
  }

  const handleClose = (): void => {
    window.api.close()
  }

  // Latency rating helper
  const getLatencyDetails = (): { color: string; label: string; bars: number } => {
    if (latency === undefined || latency === -1) {
      return { color: 'text-slate-500', label: 'Ölçülüyor...', bars: 0 }
    }
    if (latency < 85) {
      return { color: 'text-green-500', label: `${latency}ms (Hızlı)`, bars: 3 }
    }
    if (latency < 220) {
      return { color: 'text-yellow-500', label: `${latency}ms (Orta)`, bars: 2 }
    }
    return { color: 'text-red-500', label: `${latency}ms (Yavaş)`, bars: 1 }
  }

  const latencyInfo = getLatencyDetails()

  return (
    <div className="titlebar select-none border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-300 flex items-center justify-between h-[38px] pl-4 pr-0 transition-colors duration-300">
      {/* Left side: App Title & Connection status */}
      <div className="flex items-center gap-2.5 font-bold text-xs tracking-wider">
        <img src={logo} className="w-[18px] h-[18px] object-contain select-none" alt="Logo" />
        <span className="font-black">PROMHUB</span>
        {activeHostName && (
          <>
            <span className="text-slate-350 dark:text-slate-700">/</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{activeHostName}</span>
            
            {/* Latency Network Status Indicator */}
            <div className="flex items-center gap-1.5 ml-2 drag-no px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" title={`SSH Sunucu Yanıt Gecikmesi: ${latencyInfo.label}`}>
              {latency === -1 ? (
                <WifiOff size={11} className="text-red-500" />
              ) : (
                <Wifi size={11} className={latencyInfo.color} />
              )}
              <span className={`text-[9px] font-mono font-bold ${latencyInfo.color}`}>
                {latency === -1 ? 'Koptu' : `${latency}ms`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Middle/Right: Action Buttons & Window controls */}
      <div className="flex items-center h-full drag-no ml-auto">
        {/* Info/About Button */}
        <button
          onClick={onOpenInfo}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition mr-1.5"
          title="Uygulama Hakkında"
        >
          <Info size={13} />
        </button>

        {/* Global Light/Dark Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition mr-2.5"
          title={theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        {isUnlocked && onLock && (
          <button
            onClick={onLock}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition mr-3 border border-slate-200 dark:border-transparent"
            title="Kasanızı Kilitleyin"
          >
            <Shield size={10} />
            Kilitle
          </button>
        )}
        {activeHostName && onDisconnect && (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-500 border border-red-500/20 transition mr-3"
            title="Sunucu Bağlantısını Kes"
          >
            <Power size={10} />
            Bağlantıyı Kes
          </button>
        )}

        {/* Windows-style Window Controls on the right */}
        <div className="flex items-center h-full">
          <button
            onClick={handleMinimize}
            className="titlebar-btn"
            title="Simge Durumuna Getir"
          >
            {/* Minimize Icon */}
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="10" height="1" fill="currentColor"/>
            </svg>
          </button>
          <button
            onClick={handleMaximize}
            className="titlebar-btn"
            title="Ekranı Kapla"
          >
            {/* Maximize Icon */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor"/>
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="titlebar-btn titlebar-btn-close hover:bg-red-650"
            title="Kapat"
          >
            {/* Close Icon */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
