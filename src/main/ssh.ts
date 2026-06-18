import { Client, SFTPWrapper } from 'ssh2'
import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SessionInfo {
  client: Client
  sftp: SFTPWrapper | null
  config: any
}

const activeSessions = new Map<string, SessionInfo>()
const terminalStreams = new Map<string, any>() // terminalId -> stream

// Keep local in-memory diagnostic logs for SSH events
export const appDebugLogs: string[] = []

export function logDebug(msg: string): void {
  const timestamp = new Date().toLocaleTimeString()
  const logLine = `[${timestamp}] ${msg}`
  console.log(logLine)
  appDebugLogs.push(logLine)
  if (appDebugLogs.length > 300) {
    appDebugLogs.shift()
  }
}

// Helper to get active session
function getSession(connectionId: string): SessionInfo {
  const session = activeSessions.get(connectionId)
  if (!session) throw new Error(`No active SSH session found for ${connectionId}`)
  return session
}

// Convert connectionId to string key
export function getSessionKey(connectionId: number | string): string {
  return String(connectionId)
}

// Connect SSH Client
export function connectSSH(connectionId: number | string, config: any): Promise<boolean> {
  const sessionKeyStr = getSessionKey(connectionId)

  // Disconnect existing session if any
  disconnectSSH(sessionKeyStr)
  
  logDebug(`Connecting to host ${config.username}@${config.host}:${config.port || 22} (ID: ${sessionKeyStr})...`)

  return new Promise((resolve, reject) => {
    const client = new Client()

    client
      .on('ready', () => {
        logDebug(`SSH connection established with host ${config.host}. Initializing SFTP...`)
        client.sftp((err, sftp) => {
          if (err) {
            logDebug(`SFTP initialization failed: ${err.message}. Connection will continue without SFTP.`)
            activeSessions.set(sessionKeyStr, { client, sftp: null, config })
          } else {
            logDebug(`SFTP subsystem successfully initialized.`)
            activeSessions.set(sessionKeyStr, { client, sftp, config })
          }
          resolve(true)
        })
      })
      .on('error', (err) => {
        logDebug(`SSH Connection error on host ${config.host}: ${err.message}`)
        reject(err)
      })
      .on('close', () => {
        logDebug(`SSH Connection closed for host ${config.host}.`)
        activeSessions.delete(sessionKeyStr)
      })

    const connectOpts: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 20000,
      keepaliveInterval: 10000, // Send keepalive ping packets every 10s
      keepaliveCountMax: 10     // Close connection after 10 consecutive missed heartbeats
    }

    if (config.auth_type === 'password') {
      connectOpts.password = config.password
    } else {
      connectOpts.privateKey = config.private_key
    }

    client.connect(connectOpts)
  })
}

// Disconnect SSH Client
export function disconnectSSH(connectionId: number | string): void {
  const sessionKeyStr = getSessionKey(connectionId)
  const session = activeSessions.get(sessionKeyStr)
  if (session) {
    logDebug(`Requested manual disconnect for host ID ${sessionKeyStr}...`)
    try {
      session.client.end()
    } catch (e) {
      // ignore
    }
    activeSessions.delete(sessionKeyStr)
  }
}

// Check connection status
export function isConnected(connectionId: number | string): boolean {
  return activeSessions.has(getSessionKey(connectionId))
}

// Execute command on SSH server
export function execCommand(
  connectionId: number | string,
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    try {
      const { client } = getSession(getSessionKey(connectionId))
      
      // Prepend environment variables and shell profile sourcing to resolve NVM, node, pm2, docker, etc. in non-interactive shell.
      const enrichedCommand = `[ -f /etc/profile ] && . /etc/profile; [ -f ~/.profile ] && . ~/.profile; [ -f ~/.bashrc ] && . ~/.bashrc; [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"; export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/bin";\n${command}`

      client.exec(enrichedCommand, (err, stream) => {
        if (err) return reject(err)

        let stdout = ''
        let stderr = ''

        stream
          .on('close', (code: number) => {
            resolve({ stdout, stderr, code })
          })
          .on('data', (data: any) => {
            stdout += data.toString()
          })
          .stderr.on('data', (data: any) => {
            stderr += data.toString()
          })
      })
    } catch (e) {
      reject(e)
    }
  })
}

// SFTP List directory
export function sftpList(connectionId: number | string, path: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const { sftp } = getSession(getSessionKey(connectionId))
      if (!sftp) return reject(new Error('SFTP client not initialized'))

      sftp.readdir(path, (err, list) => {
        if (err) return reject(err)
        // Format attributes
        const items = list.map((item) => ({
          name: item.filename,
          isDirectory: item.longname.startsWith('d'),
          size: item.attrs.size,
          mtime: item.attrs.mtime * 1000, // to ms
          permissions: item.attrs.mode
        }))
        resolve(items)
      })
    } catch (e) {
      reject(e)
    }
  })
}

// SFTP Read file
export function sftpReadFile(connectionId: number | string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const { sftp } = getSession(getSessionKey(connectionId))
      if (!sftp) return reject(new Error('SFTP client not initialized'))

      sftp.readFile(path, (err, data) => {
        if (err) return reject(err)
        resolve(data.toString('utf8'))
      })
    } catch (e) {
      reject(e)
    }
  })
}

// SFTP Write file
export function sftpWriteFile(
  connectionId: number | string,
  path: string,
  content: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const { sftp } = getSession(getSessionKey(connectionId))
      if (!sftp) return reject(new Error('SFTP client not initialized'))

      sftp.writeFile(path, content, 'utf8', (err) => {
        if (err) return reject(err)
        resolve(true)
      })
    } catch (e) {
      reject(e)
    }
  })
}

// SFTP Create directory
export function sftpCreateDirectory(connectionId: number | string, path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const { sftp } = getSession(getSessionKey(connectionId))
      if (!sftp) return reject(new Error('SFTP client not initialized'))

      sftp.mkdir(path, (err) => {
        if (err) return reject(err)
        resolve(true)
      })
    } catch (e) {
      reject(e)
    }
  })
}

// SFTP Delete file/directory
export function sftpDelete(
  connectionId: number | string,
  path: string,
  isDirectory: boolean
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const { sftp } = getSession(getSessionKey(connectionId))
      if (!sftp) return reject(new Error('SFTP client not initialized'))

      if (isDirectory) {
        sftp.rmdir(path, (err) => {
          if (err) return reject(err)
          resolve(true)
        })
      } else {
        sftp.unlink(path, (err) => {
          if (err) return reject(err)
          resolve(true)
        })
      }
    } catch (e) {
      reject(e)
    }
  })
}

// Initialize Interactive Terminal (Shell)
export function initTerminal(
  connectionId: number | string,
  terminalId: string,
  cols: number,
  rows: number,
  window: BrowserWindow
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const { client } = getSession(getSessionKey(connectionId))

      client.shell({ cols, rows, term: 'xterm-256color' }, (err, stream) => {
        if (err) return reject(err)

        terminalStreams.set(terminalId, stream)

        // Stream data to Renderer
        stream.on('data', (data: any) => {
          if (!window.isDestroyed()) {
            window.webContents.send(`ssh:terminal-data:${terminalId}`, data.toString('utf8'))
          }
        })

        stream.on('close', () => {
          if (!window.isDestroyed()) {
            window.webContents.send(`ssh:terminal-closed:${terminalId}`)
          }
          terminalStreams.delete(terminalId)
        })

        resolve(true)
      })
    } catch (e) {
      reject(e)
    }
  })
}

// Send terminal input
export function writeTerminal(terminalId: string, data: string): void {
  const stream = terminalStreams.get(terminalId)
  if (stream) {
    stream.write(data)
  }
}

// Resize terminal
export function resizeTerminal(terminalId: string, cols: number, rows: number): void {
  const stream = terminalStreams.get(terminalId)
  if (stream) {
    stream.setWindow(rows, cols, 0, 0)
  }
}

// Close terminal
export function closeTerminal(terminalId: string): void {
  const stream = terminalStreams.get(terminalId)
  if (stream) {
    stream.end()
    terminalStreams.delete(terminalId)
  }
}

// Register all SSH IPC channels
export function registerSSHIPC(): void {
  ipcMain.handle('ssh:connect', async (_, { id, config }) => {
    try {
      return await connectSSH(id, config)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('ssh:disconnect', async (_, id) => {
    disconnectSSH(id)
    return true
  })

  ipcMain.handle('ssh:is-connected', async (_, id) => {
    return isConnected(id)
  })

  ipcMain.handle('ssh:exec', async (_, { id, command }) => {
    try {
      return await execCommand(id, command)
    } catch (e: any) {
      return { error: e.message, stdout: '', stderr: e.message, code: -1 }
    }
  })

  // SFTP Operations
  ipcMain.handle('sftp:list', async (_, { id, path }) => {
    try {
      return await sftpList(id, path)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('sftp:read', async (_, { id, path }) => {
    try {
      return await sftpReadFile(id, path)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('sftp:write', async (_, { id, path, content }) => {
    try {
      return await sftpWriteFile(id, path, content)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('sftp:mkdir', async (_, { id, path }) => {
    try {
      return await sftpCreateDirectory(id, path)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('sftp:delete', async (_, { id, path, isDirectory }) => {
    try {
      return await sftpDelete(id, path, isDirectory)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  // Terminal Operations
  ipcMain.handle('ssh:term-init', async (event, { id, terminalId, cols, rows }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    try {
      return await initTerminal(id, terminalId, cols, rows, window)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.on('ssh:term-write', (_, { terminalId, data }) => {
    writeTerminal(terminalId, data)
  })

  ipcMain.on('ssh:term-resize', (_, { terminalId, cols, rows }) => {
    resizeTerminal(terminalId, cols, rows)
  })

  ipcMain.on('ssh:term-close', (_, terminalId) => {
    closeTerminal(terminalId)
  })

  // Diagnostic Logs & Latency Monitor IPC Handlers
  ipcMain.handle('ssh:get-debug-logs', async () => {
    return appDebugLogs
  })

  ipcMain.handle('ssh:ping', async (_, id) => {
    const start = Date.now()
    try {
      await execCommand(id, 'echo 1')
      const latency = Date.now() - start
      logDebug(`Latency check: Connection round-trip latency to host ID ${id} is ${latency}ms.`)
      return latency
    } catch (e: any) {
      logDebug(`Ping failed to host ID ${id}: ${e.message}`)
      return -1
    }
  })

  ipcMain.handle('ssh:send-to-antigravity', async (_, { logData }) => {
    try {
      const workspacePath = 'c:\\Users\\Kaan\\Desktop\\Yazılım\\ssh editor'
      const targetPath = path.join(workspacePath, 'info', 'ai_log_chat.json')
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(targetPath, JSON.stringify(logData, null, 2), 'utf8')
      return { success: true }
    } catch (e: any) {
      return { error: e.message }
    }
  })

  // SFTP Transfer Dialogs and Background Queues
  ipcMain.handle('sftp:upload-dialog', async (event, { id, remoteDir, type }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { error: 'No window found' }

    const options: any = {
      title: type === 'folder' ? 'Yüklenecek Klasörü Seçin' : 'Yüklenecek Dosyaları Seçin',
      buttonLabel: 'Yükle',
      properties: type === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections']
    }

    const result = await dialog.showOpenDialog(window, options)
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const sessionKeyStr = getSessionKey(id)
    const session = activeSessions.get(sessionKeyStr)
    if (!session || !session.sftp) {
      return { error: 'SFTP client not initialized' }
    }

    // Start background transfers
    for (const localPath of result.filePaths) {
      const stats = fs.statSync(localPath)
      const baseName = path.basename(localPath)
      const remotePath = remoteDir === '/' ? `/${baseName}` : `${remoteDir}/${baseName}`
      const transferId = Math.random().toString(36).substring(7)

      if (stats.isDirectory()) {
        uploadDirectoryBackground(window, session.sftp, localPath, remotePath, transferId)
      } else {
        uploadFileBackground(window, session.sftp, localPath, remotePath, transferId, stats.size)
      }
    }

    return { success: true }
  })

  ipcMain.handle('sftp:download-dialog', async (event, { id, remotePath, isDirectory }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { error: 'No window found' }

    const baseName = path.basename(remotePath)
    const options: any = {
      title: isDirectory ? 'Klasörün İndirileceği Konumu Seçin' : 'Dosyanın İndirileceği Konumu Seçin',
      defaultPath: baseName,
      buttonLabel: 'İndir'
    }

    let result
    if (isDirectory) {
      options.properties = ['openDirectory', 'createDirectory']
      result = await dialog.showOpenDialog(window, options)
    } else {
      result = await dialog.showSaveDialog(window, options)
    }

    if (result.canceled || (!isDirectory && !result.filePath) || (isDirectory && result.filePaths.length === 0)) {
      return { success: false, error: 'Cancelled' }
    }

    const localPath = isDirectory ? path.join(result.filePaths[0], baseName) : result.filePath
    const sessionKeyStr = getSessionKey(id)
    const session = activeSessions.get(sessionKeyStr)
    if (!session || !session.sftp) {
      return { error: 'SFTP client not initialized' }
    }

    const transferId = Math.random().toString(36).substring(7)

    if (isDirectory) {
      downloadDirectoryBackground(window, session.sftp, remotePath, localPath, transferId)
    } else {
      downloadFileBackground(window, session.sftp, remotePath, localPath, transferId)
    }

    return { success: true }
  })
}

// Background transfer helpers
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

function sendTransferUpdate(window: BrowserWindow, transfer: TransferItem): void {
  if (!window.isDestroyed()) {
    window.webContents.send('sftp:transfer-status', transfer)
  }
}

async function ensureRemoteDirExists(sftp: SFTPWrapper, remoteDir: string): Promise<void> {
  const parts = remoteDir.split('/').filter(Boolean)
  let current = ''
  for (const part of parts) {
    current += '/' + part
    await new Promise<void>((resolve) => {
      sftp.mkdir(current, () => resolve())
    })
  }
}

async function uploadFileBackground(
  window: BrowserWindow,
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  transferId: string,
  size: number
): Promise<void> {
  const name = path.basename(localPath)
  const transfer: TransferItem = {
    id: transferId,
    name,
    localPath,
    remotePath,
    direction: 'upload',
    status: 'transferring',
    progress: 0,
    size
  }

  sendTransferUpdate(window, transfer)

  try {
    const parentDir = path.dirname(remotePath).replace(/\\/g, '/')
    await ensureRemoteDirExists(sftp, parentDir)

    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (transferred, _chunk, total) => {
            const progress = Math.round((transferred / total) * 100)
            transfer.progress = progress
            sendTransferUpdate(window, transfer)
          }
        },
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })

    transfer.status = 'completed'
    transfer.progress = 100
    sendTransferUpdate(window, transfer)

    if (!window.isDestroyed()) {
      window.webContents.send('sftp:refresh-directory', { remotePath })
    }
  } catch (err: any) {
    transfer.status = 'failed'
    transfer.error = err.message
    sendTransferUpdate(window, transfer)
  }
}

async function uploadDirectoryBackground(
  window: BrowserWindow,
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  transferId: string
): Promise<void> {
  const name = path.basename(localPath)
  const transfer: TransferItem = {
    id: transferId,
    name,
    localPath,
    remotePath,
    direction: 'upload',
    status: 'transferring',
    progress: 0
  }

  sendTransferUpdate(window, transfer)

  try {
    const filesToUpload: { local: string; remote: string; size: number }[] = []

    function collectFiles(localDir: string, remoteDir: string): void {
      const entries = fs.readdirSync(localDir, { withFileTypes: true })
      for (const entry of entries) {
        const lp = path.join(localDir, entry.name)
        const rp = remoteDir === '/' ? `/${entry.name}` : `${remoteDir}/${entry.name}`
        if (entry.isDirectory()) {
          collectFiles(lp, rp)
        } else {
          const size = fs.statSync(lp).size
          filesToUpload.push({ local: lp, remote: rp, size })
        }
      }
    }

    collectFiles(localPath, remotePath)

    const totalFiles = filesToUpload.length
    if (totalFiles === 0) {
      await ensureRemoteDirExists(sftp, remotePath)
      transfer.status = 'completed'
      transfer.progress = 100
      sendTransferUpdate(window, transfer)
      return
    }

    let filesDone = 0

    for (const file of filesToUpload) {
      const parentDir = path.dirname(file.remote).replace(/\\/g, '/')
      await ensureRemoteDirExists(sftp, parentDir)

      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(file.local, file.remote, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      filesDone++
      transfer.progress = Math.round((filesDone / totalFiles) * 100)
      sendTransferUpdate(window, transfer)
    }

    transfer.status = 'completed'
    sendTransferUpdate(window, transfer)

    if (!window.isDestroyed()) {
      window.webContents.send('sftp:refresh-directory', { remotePath })
    }
  } catch (err: any) {
    transfer.status = 'failed'
    transfer.error = err.message
    sendTransferUpdate(window, transfer)
  }
}

async function downloadFileBackground(
  window: BrowserWindow,
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string,
  transferId: string
): Promise<void> {
  const name = path.basename(remotePath)
  const transfer: TransferItem = {
    id: transferId,
    name,
    localPath,
    remotePath,
    direction: 'download',
    status: 'transferring',
    progress: 0
  }

  sendTransferUpdate(window, transfer)

  try {
    const stats = await new Promise<any>((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) reject(err)
        else resolve(stats)
      })
    })

    transfer.size = stats.size
    sendTransferUpdate(window, transfer)

    const localParent = path.dirname(localPath)
    if (!fs.existsSync(localParent)) {
      fs.mkdirSync(localParent, { recursive: true })
    }

    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (transferred, _chunk, total) => {
            const progress = Math.round((transferred / total) * 100)
            transfer.progress = progress
            sendTransferUpdate(window, transfer)
          }
        },
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })

    transfer.status = 'completed'
    transfer.progress = 100
    sendTransferUpdate(window, transfer)
  } catch (err: any) {
    transfer.status = 'failed'
    transfer.error = err.message
    sendTransferUpdate(window, transfer)
  }
}

async function downloadDirectoryBackground(
  window: BrowserWindow,
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string,
  transferId: string
): Promise<void> {
  const name = path.basename(remotePath)
  const transfer: TransferItem = {
    id: transferId,
    name,
    localPath,
    remotePath,
    direction: 'download',
    status: 'transferring',
    progress: 0
  }

  sendTransferUpdate(window, transfer)

  try {
    const filesToDownload: { remote: string; local: string }[] = []

    async function collectRemoteFiles(rDir: string, lDir: string): Promise<void> {
      const list = await new Promise<any[]>((resolve, reject) => {
        sftp.readdir(rDir, (err, entries) => {
          if (err) return reject(err)
          resolve(entries)
        })
      })

      for (const entry of list) {
        if (entry.filename === '.' || entry.filename === '..') continue
        const rp = rDir === '/' ? `/${entry.filename}` : `${rDir}/${entry.filename}`
        const lp = path.join(lDir, entry.filename)
        const isDir = entry.longname.startsWith('d')

        if (isDir) {
          await collectRemoteFiles(rp, lp)
        } else {
          filesToDownload.push({ remote: rp, local: lp })
        }
      }
    }

    await collectRemoteFiles(remotePath, localPath)

    const totalFiles = filesToDownload.length
    if (totalFiles === 0) {
      fs.mkdirSync(localPath, { recursive: true })
      transfer.status = 'completed'
      transfer.progress = 100
      sendTransferUpdate(window, transfer)
      return
    }

    let filesDone = 0

    for (const file of filesToDownload) {
      const parentDir = path.dirname(file.local)
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      await new Promise<void>((resolve, reject) => {
        sftp.fastGet(file.remote, file.local, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      filesDone++
      transfer.progress = Math.round((filesDone / totalFiles) * 100)
      sendTransferUpdate(window, transfer)
    }

    transfer.status = 'completed'
    sendTransferUpdate(window, transfer)
  } catch (err: any) {
    transfer.status = 'failed'
    transfer.error = err.message
    sendTransferUpdate(window, transfer)
  }
}


