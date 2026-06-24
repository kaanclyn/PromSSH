import { contextBridge, ipcRenderer, clipboard } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface Connection {
  id?: number
  name: string
  host: string
  port: number
  username: string
  auth_type: 'password' | 'key'
  password?: string
  private_key?: string
  favorite: number
  protocol?: 'ssh' | 'ftp'
  created_at?: string
  last_connected?: string
}

// Custom APIs for renderer
const api = {
  // Window Controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),

  // Database operations
  hasMasterPassword: () => ipcRenderer.invoke('db:has-master-password'),
  setMasterPassword: (password: string) => ipcRenderer.invoke('db:set-master-password', { password }),
  unlock: (password: string) => ipcRenderer.invoke('db:unlock', { password }),
  lock: () => ipcRenderer.invoke('db:lock'),
  isUnlocked: () => ipcRenderer.invoke('db:is-unlocked'),
  getConnections: () => ipcRenderer.invoke('db:get-connections'),
  addConnection: (conn: any) => ipcRenderer.invoke('db:add-connection', { conn }),
  updateConnection: (id: number, conn: any) => ipcRenderer.invoke('db:update-connection', { id, conn }),
  deleteConnection: (id: number) => ipcRenderer.invoke('db:delete-connection', { id }),
  updateLastConnected: (id: number) => ipcRenderer.invoke('db:update-last-connected', { id }),
  getSetting: (key: string) => ipcRenderer.invoke('db:get-setting', { key }),
  saveSetting: (key: string, value: string) => ipcRenderer.invoke('db:save-setting', { key, value }),

  // SSH / SFTP operations
  sshConnect: (id: number | string, config: any) => ipcRenderer.invoke('ssh:connect', { id, config }),
  sshDisconnect: (id: number | string) => ipcRenderer.invoke('ssh:disconnect', id),
  sshIsConnected: (id: number | string) => ipcRenderer.invoke('ssh:is-connected', id),
  sshExec: (id: number | string, command: string) => ipcRenderer.invoke('ssh:exec', { id, command }),
  sshGetDebugLogs: () => ipcRenderer.invoke('ssh:get-debug-logs'),
  sshPing: (id: number | string) => ipcRenderer.invoke('ssh:ping', id),
  sftpList: (id: number | string, path: string) => ipcRenderer.invoke('sftp:list', { id, path }),
  sftpRead: (id: number | string, path: string) => ipcRenderer.invoke('sftp:read', { id, path }),
  sftpWrite: (id: number | string, path: string, content: string) => ipcRenderer.invoke('sftp:write', { id, path, content }),
  sftpMkdir: (id: number | string, path: string) => ipcRenderer.invoke('sftp:mkdir', { id, path }),
  sftpDelete: (id: number | string, path: string, isDirectory: boolean) => ipcRenderer.invoke('sftp:delete', { id, path, isDirectory }),
  sendToAntigravity: (logData: any) => ipcRenderer.invoke('ssh:send-to-antigravity', { logData }),
  sftpUploadDialog: (id: number | string, remoteDir: string, type: 'file' | 'folder') =>
    ipcRenderer.invoke('sftp:upload-dialog', { id, remoteDir, type }),
  sftpDownloadDialog: (id: number | string, remotePath: string, isDirectory: boolean) =>
    ipcRenderer.invoke('sftp:download-dialog', { id, remotePath, isDirectory }),
  onTransferStatus: (callback: (transfer: any) => void) => {
    const channel = 'sftp:transfer-status'
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },
  onRefreshDirectory: (callback: (data: { remotePath: string }) => void) => {
    const channel = 'sftp:refresh-directory'
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },


  // Interactive Terminal
  termInit: (id: number | string, terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('ssh:term-init', { id, terminalId, cols, rows }),
  termWrite: (terminalId: string, data: string) =>
    ipcRenderer.send('ssh:term-write', { terminalId, data }),
  termResize: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.send('ssh:term-resize', { terminalId, cols, rows }),
  termClose: (terminalId: string) =>
    ipcRenderer.send('ssh:term-close', terminalId),

  onTermData: (terminalId: string, callback: (data: string) => void) => {
    const channel = `ssh:terminal-data:${terminalId}`
    const listener = (_event: any, data: string) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  onTermClosed: (terminalId: string, callback: () => void) => {
    const channel = `ssh:terminal-closed:${terminalId}`
    const listener = () => callback()
    ipcRenderer.once(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  clipboardReadText: () => clipboard.readText(),
  clipboardWriteText: (text: string) => clipboard.writeText(text),
  getLocalSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  getLiveTelemetry: () => ipcRenderer.invoke('system:get-live'),
  openPath: (filePath: string) => ipcRenderer.invoke('win:open-path', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('win:show-item-in-folder', filePath),
  exportJson: (systemData: any) => ipcRenderer.invoke('system:export-json', systemData),
  exportExcel: (systemData: any) => ipcRenderer.invoke('system:export-excel', systemData)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
