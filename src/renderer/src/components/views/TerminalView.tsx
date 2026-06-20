import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, Terminal as TermIcon } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalViewProps {
  connectionId: number | string
}

interface TabItem {
  id: string
  name: string
}

export const TerminalView: React.FC<TerminalViewProps> = ({ connectionId }) => {
  const [tabs, setTabs] = useState<TabItem[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const tabCounter = useRef<number>(1)

  // Initialize with one tab
  useEffect(() => {
    createNewTab()
  }, [connectionId])

  const createNewTab = (): void => {
    const id = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newTab = {
      id,
      name: `Terminal ${tabCounter.current++}`
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(id)
  }

  const closeTab = (tabId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id)
      } else if (filtered.length === 0) {
        setActiveTabId(null)
      }
      return filtered
    })
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-850 dark:text-white overflow-hidden select-none transition-colors duration-300">
      {/* Tab bar */}
      <div className="h-11 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 flex items-center gap-2 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-1 overflow-x-auto flex-1 h-full py-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-2 px-3 h-full rounded-md text-xs font-semibold cursor-pointer transition select-none ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-b-2 border-indigo-500'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-900 hover:text-slate-850 dark:hover:text-slate-200'
                }`}
              >
                <TermIcon size={12} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-450 dark:text-slate-500'} />
                <span>{tab.name}</span>
                <button
                  onClick={(e) => closeTab(tab.id, e)}
                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>

        <button
          onClick={createNewTab}
          className="p-1.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-white transition shrink-0"
          title="Yeni Terminal Sekmesi"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Terminals instances */}
      <div className="flex-1 relative bg-[#020617]">
        {tabs.map((tab) => (
          <TerminalInstance
            key={tab.id}
            connectionId={connectionId}
            terminalId={tab.id}
            isVisible={tab.id === activeTabId}
          />
        ))}

        {tabs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <TermIcon size={32} className="mb-2" />
            <span className="text-xs">Aktif terminal sekmesi bulunmuyor. "+" butonuna basarak yeni bir oturum açın.</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface TerminalInstanceProps {
  connectionId: number | string
  terminalId: string
  isVisible: boolean
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({
  connectionId,
  terminalId,
  isVisible
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [hasSelection, setHasSelection] = useState<boolean>(false)

  useEffect(() => {
    if (!containerRef.current) return

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#020617', // slate-950
        foreground: '#cbd5e1', // slate-300
        cursor: '#14b8a6', // matching custom Teal theme
        selectionBackground: 'rgba(20, 184, 166, 0.3)'
      },
      fontSize: 13,
      fontFamily: 'Consolas, monospace'
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Mount terminal
    term.open(containerRef.current)
    fitAddon.fit()

    // Initialize terminal stream in main process
    const cols = term.cols
    const rows = term.rows

    window.api.termInit(connectionId, terminalId, cols, rows).then((res) => {
      if (res && typeof res === 'object' && 'error' in res) {
        term.write(`\r\n\x1b[31mTerminal bağlantısı kurulamadı: ${res.error}\x1b[0m\r\n`)
      }
    })

    // Bind inputs
    term.onData((data) => {
      window.api.termWrite(terminalId, data)
    })

    // Listen to data from main process
    const unsubscribeData = window.api.onTermData(terminalId, (data) => {
      term.write(data)
    })

    // Listen to close event from main process
    const unsubscribeClosed = window.api.onTermClosed(terminalId, () => {
      term.write('\r\n\x1b[33mOturum kapatıldı.\x1b[0m\r\n')
    })

    // Bind keyboard shortcuts for copy/paste
    term.attachCustomKeyEventHandler((event) => {
      const isV = event.key.toLowerCase() === 'v' || event.code === 'KeyV'
      const isC = event.key.toLowerCase() === 'c' || event.code === 'KeyC'

      // Ctrl+V (Paste)
      if ((event.ctrlKey || event.metaKey) && isV) {
        if (event.type === 'keydown') {
          const text = window.api.clipboardReadText()
          if (text) {
            window.api.termWrite(terminalId, text)
          }
        }
        return false
      }

      // Ctrl+C (Copy - only if text is selected)
      if ((event.ctrlKey || event.metaKey) && isC) {
        if (term.hasSelection()) {
          if (event.type === 'keydown') {
            const text = term.getSelection()
            window.api.clipboardWriteText(text)
          }
          return false
        }
      }

      return true
    })

    // Handle right-click context menu positioning
    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      if (!term || !containerRef.current) return
      setHasSelection(term.hasSelection())
      const rect = containerRef.current.getBoundingClientRect()
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu)
    }

    // Handle window resize
    const handleResize = (): void => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit()
        window.api.termResize(terminalId, termRef.current.cols, termRef.current.rows)
      }
    }
    window.addEventListener('resize', handleResize)

    // Close menu when clicking elsewhere
    const handleWindowClick = (): void => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleWindowClick)

    // Fit terminal on first visibility
    if (isVisible) {
      setTimeout(handleResize, 100)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('click', handleWindowClick)
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu)
      }
      unsubscribeData()
      unsubscribeClosed()
      window.api.termClose(terminalId)
      term.dispose()
    }
  }, [connectionId, terminalId])

  // Fit terminal when tab becomes visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
        if (termRef.current) {
          window.api.termResize(terminalId, termRef.current.cols, termRef.current.rows)
          termRef.current.focus()
        }
      }, 50)
    }
  }, [isVisible])

  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (termRef.current) {
      const text = termRef.current.getSelection()
      window.api.clipboardWriteText(text)
      termRef.current.clearSelection()
      termRef.current.focus()
    }
    setContextMenu(null)
  }

  const handlePaste = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const text = window.api.clipboardReadText()
    if (text) {
      window.api.termWrite(terminalId, text)
    }
    termRef.current?.focus()
    setContextMenu(null)
  }

  return (
    <div className={`absolute inset-0 bg-[#020617] ${isVisible ? 'block' : 'hidden'}`}>
      <div
        ref={containerRef}
        className="absolute inset-0 p-2 overflow-hidden bg-[#020617]"
      />
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="absolute bg-slate-900 border border-slate-800 text-slate-200 py-1 rounded shadow-xl z-50 text-xs font-semibold w-28 select-none transition-all"
        >
          <button
            onClick={handleCopy}
            disabled={!hasSelection}
            className="w-full text-left px-3 py-1.5 hover:bg-teal-600 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition"
          >
            Kopyala
          </button>
          <button
            onClick={handlePaste}
            className="w-full text-left px-3 py-1.5 hover:bg-teal-600 hover:text-white transition"
          >
            Yapıştır
          </button>
        </div>
      )}
    </div>
  )
}
