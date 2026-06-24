import {
  LayoutDashboard,
  Cpu,
  FolderOpen,
  Settings,
  Database,
  Zap,
  Radio,
  FileText,
  Terminal as TerminalIcon,
  Sparkles
} from 'lucide-react'

interface SidebarProps {
  currentView: string
  setView: (view: string) => void
  hasDocker: boolean
  hasPM2: boolean
  protocol?: 'ssh' | 'ftp'
  onOpenSnippets?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  hasDocker,
  hasPM2,
  protocol = 'ssh',
  onOpenSnippets
}) => {
  const allMenuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'technology', name: 'Teknolojiler', icon: <Cpu size={16} /> },
    { id: 'files', name: 'Dosya Gezgini', icon: <FolderOpen size={16} /> },

    { id: 'services', name: 'Servisler', icon: <Settings size={16} /> },
    ...(hasDocker ? [{ id: 'docker', name: 'Docker', icon: <Database size={16} /> }] : []),
    ...(hasPM2 ? [{ id: 'pm2', name: 'PM2', icon: <Zap size={16} /> }] : []),
    { id: 'ports', name: 'Portlar', icon: <Radio size={16} /> },
    { id: 'logs', name: 'Loglar', icon: <FileText size={16} /> },
    { id: 'terminal', name: 'Terminal', icon: <TerminalIcon size={16} /> }
  ]

  const menuItems = protocol === 'ftp'
    ? [{ id: 'files', name: 'Dosya Gezgini', icon: <FolderOpen size={16} /> }]
    : allMenuItems

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col select-none transition-colors duration-300">
      <div className="flex-grow py-4 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          )
        })}
      </div>

      {onOpenSnippets && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={onOpenSnippets}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30 transition-all duration-200 shadow-sm"
          >
            <Sparkles size={13} className="animate-pulse" />
            <span>Hızlı Snippetlar</span>
          </button>
        </div>
      )}
    </div>
  )
}
