import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface ClientAPI {
  minimize: () => void
  maximize: () => void
  close: () => void

  hasMasterPassword: () => Promise<boolean>
  setMasterPassword: (password: string) => Promise<boolean>
  unlock: (password: string) => Promise<boolean>
  lock: () => Promise<boolean>
  isUnlocked: () => Promise<boolean>
  getConnections: () => Promise<Connection[] | { error: string }>
  addConnection: (conn: Connection) => Promise<number | { error: string }>
  updateConnection: (id: number, conn: Connection) => Promise<boolean | { error: string }>
  deleteConnection: (id: number) => Promise<boolean | { error: string }>
  updateLastConnected: (id: number) => Promise<boolean | { error: string }>
  getSetting: (key: string) => Promise<string | null>
  saveSetting: (key: string, value: string) => Promise<boolean>

  sshConnect: (id: number | string, config: any) => Promise<boolean | { error: string }>
  sshDisconnect: (id: number | string) => Promise<boolean>
  sshIsConnected: (id: number | string) => Promise<boolean>
  sshExec: (id: number | string, command: string) => Promise<{ stdout: string; stderr: string; code: number; error?: string }>
  sshGetDebugLogs: () => Promise<string[]>
  sshPing: (id: number | string) => Promise<number>
  sftpList: (id: number | string, path: string) => Promise<any[] | { error: string }>
  sftpRead: (id: number | string, path: string) => Promise<string | { error: string }>
  sftpWrite: (id: number | string, path: string, content: string) => Promise<boolean | { error: string }>
  sftpMkdir: (id: number | string, path: string) => Promise<boolean | { error: string }>
  sftpDelete: (id: number | string, path: string, isDirectory: boolean) => Promise<boolean | { error: string }>
  sendToAntigravity: (logData: any) => Promise<{ success: boolean; error?: string }>
  sftpUploadDialog: (id: number | string, remoteDir: string, type: 'file' | 'folder') => Promise<{ success: boolean; error?: string }>
  sftpDownloadDialog: (id: number | string, remotePath: string, isDirectory: boolean) => Promise<{ success: boolean; error?: string }>
  onTransferStatus: (callback: (transfer: any) => void) => () => void
  onRefreshDirectory: (callback: (data: { remotePath: string }) => void) => () => void

  termInit: (id: number | string, terminalId: string, cols: number, rows: number) => Promise<boolean | { error: string }>
  termWrite: (terminalId: string, data: string) => void
  termResize: (terminalId: string, cols: number, rows: number) => void
  termClose: (terminalId: string) => void
  onTermData: (terminalId: string, callback: (data: string) => void) => () => void
  onTermClosed: (terminalId: string, callback: () => void) => () => void
  clipboardReadText: () => string
  clipboardWriteText: (text: string) => void
  getLocalSystemInfo: () => Promise<any>
  getLiveTelemetry: () => Promise<any>
  openPath: (filePath: string) => Promise<{ success?: boolean; error?: string }>
  showItemInFolder: (filePath: string) => Promise<{ success?: boolean; error?: string }>
  exportJson: (systemData: any) => Promise<{ filePath?: string; error?: string }>
  exportExcel: (systemData: any) => Promise<{ filePath?: string; error?: string }>
  importFileZilla: () => Promise<{ success: boolean; count?: number; error?: string }>
  exportFileZilla: () => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ClientAPI
  }
}
