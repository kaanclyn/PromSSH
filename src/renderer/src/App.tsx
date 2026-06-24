import React, { useState, useEffect } from 'react'
import { Titlebar } from './components/Titlebar'
import { HostList } from './components/HostList'
import { Sidebar } from './components/Sidebar'
import { DashboardView } from './components/views/DashboardView'
import { TechnologyDetector } from './components/views/TechnologyDetector'
import { FileExplorerView } from './components/views/FileExplorerView'
import { ServiceCenterView } from './components/views/ServiceCenterView'
import { DockerCenterView } from './components/views/DockerCenterView'
import { PM2CenterView } from './components/views/PM2CenterView'
import { PortCenterView } from './components/views/PortCenterView'
import { LogCenterView } from './components/views/LogCenterView'
import { TerminalView } from './components/views/TerminalView'
import { SnippetDrawer } from './components/SnippetDrawer'
import { InfoModal } from './components/InfoModal'
import { LocalSystemView } from './components/views/LocalSystemView'
import { Connection } from '../../preload/api'
import { RefreshCw } from 'lucide-react'

function App(): React.JSX.Element {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [activeConn, setActiveConn] = useState<Connection | null>(null)
  const [currentView, setView] = useState<string>('dashboard')

  // Theme, Latency, Snippet drawer states
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [latency, setLatency] = useState<number>(-1)
  const [showSnippetDrawer, setShowSnippetDrawer] = useState<boolean>(false)
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false)
  const [showLocalPC, setShowLocalPC] = useState<boolean>(false)

  // Feature detection
  const [hasDocker, setHasDocker] = useState<boolean>(false)
  const [hasPM2, setHasPM2] = useState<boolean>(false)

  // Connection process
  const [connecting, setConnecting] = useState<boolean>(false)
  const [connectError, setConnectError] = useState<string>('')



  useEffect(() => {
    checkUnlockState()
    loadTheme()
  }, [])

  const loadTheme = async (): Promise<void> => {
    const savedTheme = await window.api.getSetting('theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme)
    }
  }

  const toggleTheme = async (): Promise<void> => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    await window.api.saveSetting('theme', nextTheme)
  }

  const checkUnlockState = async (): Promise<void> => {
    const unlocked = await window.api.isUnlocked()
    setIsUnlocked(unlocked)
  }

  const handleUnlockSuccess = (): void => {
    setIsUnlocked(true)
  }

  const handleLock = async (): Promise<void> => {
    await window.api.lock()
    setIsUnlocked(false)
    setActiveConn(null)
  }

  const handleConnect = async (conn: Connection): Promise<void> => {
    if (!conn.id) return
    setConnecting(true)
    setConnectError('')
    try {
      const success = await window.api.sshConnect(conn.id, conn)
      if (success === true) {
        // Mark last connected
        await window.api.updateLastConnected(conn.id)
        setActiveConn(conn)
        setView(conn.protocol === 'ftp' ? 'files' : 'dashboard')
        setHasDocker(false) // reset until check
        setHasPM2(false)
      } else if (success && typeof success === 'object' && 'error' in success) {
        setConnectError(success.error)
      } else {
        setConnectError('Bağlantı başarısız oldu.')
      }
    } catch (e: any) {
      setConnectError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (): Promise<void> => {
    if (activeConn && activeConn.id) {
      await window.api.sshDisconnect(activeConn.id)
      setActiveConn(null)
    }
  }


  const handleScanComplete = (dockerInstalled: boolean, pm2Installed: boolean): void => {
    setHasDocker(dockerInstalled)
    setHasPM2(pm2Installed)
  }

  // Periodic Latency Ping check when SSH is connected
  useEffect(() => {
    if (!activeConn || !activeConn.id || activeConn.protocol === 'ftp') {
      setLatency(-1)
      return
    }

    const checkPing = async (): Promise<void> => {
      if (activeConn && activeConn.id) {
        const ms = await window.api.sshPing(activeConn.id)
        setLatency(ms)
      }
    }

    checkPing()

    const interval = setInterval(checkPing, 8000) // check latency every 8 seconds
    return () => clearInterval(interval)
  }, [activeConn])

  // Render subview based on sidebar item selection
  const renderView = (): React.ReactNode => {
    if (!activeConn || !activeConn.id) return null

    switch (currentView) {
      case 'dashboard':
        return <DashboardView connectionId={activeConn.id} />
      case 'technology':
        return (
          <TechnologyDetector
            connectionId={activeConn.id}
            onScanComplete={handleScanComplete}
          />
        )
      case 'files':
        return (
          <FileExplorerView
            connectionId={activeConn.id}
            initialPath={activeConn.protocol === 'ftp' ? '/' : '/var/www'}
          />
        )
      case 'services':
        return <ServiceCenterView connectionId={activeConn.id} />
      case 'docker':
        return <DockerCenterView connectionId={activeConn.id} />
      case 'pm2':
        return <PM2CenterView connectionId={activeConn.id} />
      case 'ports':
        return <PortCenterView connectionId={activeConn.id} />
      case 'logs':
        return <LogCenterView connectionId={activeConn.id} />
      case 'terminal':
        return <TerminalView connectionId={activeConn.id} />
      default:
        return <DashboardView connectionId={activeConn.id} />
    }
  }

  return (
    <div className={`${theme} flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300`}>
      {/* Frameless top title bar */}
      <Titlebar
        activeHostName={activeConn?.name}
        isUnlocked={isUnlocked}
        onLock={handleLock}
        onDisconnect={handleDisconnect}
        theme={theme}
        toggleTheme={toggleTheme}
        latency={latency}
        onOpenInfo={() => setShowInfoModal(true)}
      />

      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />

      {connecting ? (
        // CONNECTING SCREEN
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white">
          <RefreshCw className="animate-spin mb-4 text-indigo-500" size={36} />
          <h3 className="text-lg font-bold mb-1">Sunucuya Bağlanılıyor</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {activeConn?.username}@{activeConn?.host}:{activeConn?.port}
          </p>
        </div>
      ) : connectError ? (
        // CONNECTION ERROR SCREEN
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white">
          <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-4">
            <RefreshCw size={36} />
          </div>
          <h3 className="text-lg font-bold mb-2 text-red-400">Bağlantı Hatası</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md text-center leading-relaxed font-mono bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-850 mb-6 select-text">
            {connectError}
          </p>
          <button
            onClick={() => setConnectError('')}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-semibold transition"
          >
            Sunucu Listesine Dön
          </button>
        </div>
      ) : activeConn ? (
        // MAIN WORKSPACE INTERFACE
        <div className="flex-grow flex overflow-hidden relative">
          <Sidebar
            currentView={currentView}
            setView={setView}
            hasDocker={hasDocker}
            hasPM2={hasPM2}
            protocol={activeConn.protocol}
            onOpenSnippets={activeConn.protocol === 'ftp' ? undefined : () => setShowSnippetDrawer(true)}
          />
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {renderView()}
            {activeConn && activeConn.id && (
              <SnippetDrawer
                isOpen={showSnippetDrawer}
                onClose={() => setShowSnippetDrawer(false)}
                connectionId={activeConn.id}
              />
            )}
          </div>
        </div>
      ) : showLocalPC ? (
        // LOCAL COMPUTER SYSTEM SPECS VIEW
        <LocalSystemView onBack={() => setShowLocalPC(false)} />
      ) : (
        // HOST LIST / MASTER PASSWORD ENTRY
        <HostList
          onConnect={handleConnect}
          isUnlocked={isUnlocked}
          onUnlockSuccess={handleUnlockSuccess}
          onOpenLocalPCInfo={() => setShowLocalPC(true)}
        />
      )}
    </div>
  )
}

export default App
