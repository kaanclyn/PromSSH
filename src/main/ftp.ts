import * as ftp from 'basic-ftp'
import { BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

interface FTPSession {
  client: ftp.Client
  config: any
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

const activeFTPSessions = new Map<string, FTPSession>()

export function logDebug(msg: string): void {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`[${timestamp}][FTP] ${msg}`)
}

// Connect to FTP/FTPS server
export async function connectFTP(connectionId: number | string, config: any): Promise<boolean> {
  const sessionKey = String(connectionId)
  await disconnectFTP(sessionKey)

  logDebug(`Connecting to FTP host ${config.username}@${config.host}:${config.port || 21}...`)

  const client = new ftp.Client(20000)

  try {
    const secure = config.protocol === 'ftps' || config.port === 990
    await client.access({
      host: config.host,
      port: config.port || 21,
      user: config.username,
      password: config.password,
      secure: secure,
      secureOptions: {
        rejectUnauthorized: false
      }
    })

    activeFTPSessions.set(sessionKey, { client, config })
    logDebug(`FTP Connection successful for host ${config.host}`)
    return true
  } catch (err) {
    client.close()
    logDebug(`FTP Connection failed: ${(err as Error).message}`)
    throw err
  }
}

// Disconnect FTP server
export async function disconnectFTP(connectionId: number | string): Promise<void> {
  const sessionKey = String(connectionId)
  const session = activeFTPSessions.get(sessionKey)
  if (session) {
    logDebug(`Closing FTP connection for session ${sessionKey}...`)
    try {
      session.client.close()
    } catch (e) {
      // ignore
    }
    activeFTPSessions.delete(sessionKey)
  }
}

// Check FTP connection status
export function isFTPConnected(connectionId: number | string): boolean {
  return activeFTPSessions.get(String(connectionId))?.client.closed === false
}

// Helper to ensure main client is connected and auto-reconnect if idle
async function ensureFTPConnected(connectionId: string, session: FTPSession): Promise<ftp.Client> {
  if (session.client.closed) {
    logDebug(`Reconnecting idle FTP connection for session ${connectionId}...`)
    const secure = session.config.protocol === 'ftps' || session.config.port === 990
    await session.client.access({
      host: session.config.host,
      port: session.config.port || 21,
      user: session.config.username,
      password: session.config.password,
      secure: secure,
      secureOptions: {
        rejectUnauthorized: false
      }
    })
  }
  return session.client
}

// FTP Get current working directory (home directory)
export async function ftpGetHome(connectionId: number | string): Promise<string> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')
  const client = await ensureFTPConnected(String(connectionId), session)
  return await client.pwd()
}

// FTP List directory
export async function ftpList(connectionId: number | string, remotePath: string): Promise<any[]> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Listing directory: ${remotePath}`)
  const client = await ensureFTPConnected(String(connectionId), session)
  const list = await client.list(remotePath)
  return list.map((item) => ({
    name: item.name,
    isDirectory: item.isDirectory,
    size: item.size,
    mtime: item.modifiedAt ? new Date(item.modifiedAt).getTime() : Date.now(),
    permissions: 0o755 // standard default
  }))
}

// FTP Read file
export async function ftpReadFile(connectionId: number | string, remotePath: string): Promise<string> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Reading file: ${remotePath}`)
  const client = await ensureFTPConnected(String(connectionId), session)
  const chunks: Buffer[] = []
  const { Writable } = require('stream')
  const writer = new Writable({
    write(chunk: any, _encoding: any, callback: any) {
      chunks.push(Buffer.from(chunk))
      callback()
    }
  })

  await client.downloadTo(writer, remotePath)
  return Buffer.concat(chunks).toString('utf8')
}

// FTP Write file
export async function ftpWriteFile(
  connectionId: number | string,
  remotePath: string,
  content: string
): Promise<boolean> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Writing file: ${remotePath}`)
  const client = await ensureFTPConnected(String(connectionId), session)
  const { Readable } = require('stream')
  const reader = Readable.from([Buffer.from(content, 'utf8')])

  await client.uploadFrom(reader, remotePath)
  return true
}

// FTP Create directory
export async function ftpCreateDirectory(connectionId: number | string, remotePath: string): Promise<boolean> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Creating directory: ${remotePath}`)
  const client = await ensureFTPConnected(String(connectionId), session)
  await client.ensureDir(remotePath)
  return true
}

// FTP Delete file or folder
export async function ftpDelete(
  connectionId: number | string,
  remotePath: string,
  isDirectory: boolean
): Promise<boolean> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Deleting ${isDirectory ? 'directory' : 'file'}: ${remotePath}`)
  const client = await ensureFTPConnected(String(connectionId), session)
  if (isDirectory) {
    await client.removeDir(remotePath)
  } else {
    await client.remove(remotePath)
  }
  return true
}

// FTP Upload background task (using independent client connection)
export async function ftpUpload(
  connectionId: number | string,
  localPath: string,
  remotePath: string,
  window: BrowserWindow,
  transferId: string,
  isDirectory: boolean
): Promise<void> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) return

  const name = path.basename(localPath)
  const transfer: TransferItem = {
    id: transferId,
    name,
    localPath,
    remotePath,
    direction: 'upload',
    status: 'transferring',
    progress: 0,
    size: isDirectory ? undefined : fs.statSync(localPath).size
  }

  if (!window.isDestroyed()) {
    window.webContents.send('sftp:transfer-status', transfer)
  }

  const client = new ftp.Client(20000)
  try {
    const secure = session.config.protocol === 'ftps' || session.config.port === 990
    await client.access({
      host: session.config.host,
      port: session.config.port || 21,
      user: session.config.username,
      password: session.config.password,
      secure: secure,
      secureOptions: {
        rejectUnauthorized: false
      }
    })

    if (isDirectory) {
      await client.ensureDir(remotePath)
      await client.uploadFromDir(localPath)
    } else {
      client.trackProgress((info) => {
        const progress = Math.round((info.bytesOverall / (transfer.size || 1)) * 100)
        transfer.progress = Math.min(99, progress)
        if (!window.isDestroyed()) {
          window.webContents.send('sftp:transfer-status', transfer)
        }
      })
      await client.uploadFrom(localPath, remotePath)
      client.trackProgress()
    }

    transfer.status = 'completed'
    transfer.progress = 100
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
      window.webContents.send('sftp:refresh-directory', { remotePath })
    }
  } catch (err: any) {
    client.trackProgress()
    transfer.status = 'failed'
    transfer.error = err.message
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
    }
  } finally {
    client.close()
  }
}

// FTP Download background task (using independent client connection)
export async function ftpDownload(
  connectionId: number | string,
  remotePath: string,
  localPath: string,
  window: BrowserWindow,
  transferId: string,
  isDirectory: boolean
): Promise<void> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) return

  const name = path.basename(remotePath)
  const transfer: TransferItem = {
    id: transferId,
    name,
    localPath,
    remotePath,
    direction: 'download',
    status: 'transferring',
    progress: 0,
    size: undefined
  }

  if (!window.isDestroyed()) {
    window.webContents.send('sftp:transfer-status', transfer)
  }

  const client = new ftp.Client(20000)
  try {
    const secure = session.config.protocol === 'ftps' || session.config.port === 990
    await client.access({
      host: session.config.host,
      port: session.config.port || 21,
      user: session.config.username,
      password: session.config.password,
      secure: secure,
      secureOptions: {
        rejectUnauthorized: false
      }
    })

    if (isDirectory) {
      const localParent = path.dirname(localPath)
      if (!fs.existsSync(localParent)) {
        fs.mkdirSync(localParent, { recursive: true })
      }
      await client.downloadToDir(localPath, remotePath)
    } else {
      let size = 0
      try {
        size = await client.size(remotePath)
      } catch (e) {
        // ignore
      }
      transfer.size = size

      client.trackProgress((info) => {
        const progress = Math.round((info.bytesOverall / (size || 1)) * 100)
        transfer.progress = Math.min(99, progress)
        if (!window.isDestroyed()) {
          window.webContents.send('sftp:transfer-status', transfer)
        }
      })
      await client.downloadTo(localPath, remotePath)
      client.trackProgress()
    }

    transfer.status = 'completed'
    transfer.progress = 100
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
    }
  } catch (err: any) {
    client.trackProgress()
    transfer.status = 'failed'
    transfer.error = err.message
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
    }
  } finally {
    client.close()
  }
}
