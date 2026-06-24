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

// FTP List directory
export async function ftpList(connectionId: number | string, remotePath: string): Promise<any[]> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Listing directory: ${remotePath}`)
  const list = await session.client.list(remotePath)
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
  const chunks: Buffer[] = []
  const { Writable } = require('stream')
  const writer = new Writable({
    write(chunk: any, _encoding: any, callback: any) {
      chunks.push(Buffer.from(chunk))
      callback()
    }
  })

  await session.client.downloadTo(writer, remotePath)
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
  const { Readable } = require('stream')
  const reader = Readable.from([Buffer.from(content, 'utf8')])

  await session.client.uploadFrom(reader, remotePath)
  return true
}

// FTP Create directory
export async function ftpCreateDirectory(connectionId: number | string, remotePath: string): Promise<boolean> {
  const session = activeFTPSessions.get(String(connectionId))
  if (!session) throw new Error('No active FTP session found')

  logDebug(`Creating directory: ${remotePath}`)
  await session.client.ensureDir(remotePath)
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
  if (isDirectory) {
    await session.client.removeDir(remotePath)
  } else {
    await session.client.remove(remotePath)
  }
  return true
}

// FTP Upload background task
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

  try {
    if (isDirectory) {
      await session.client.ensureDir(remotePath)
      await session.client.uploadFromDir(localPath)
    } else {
      session.client.trackProgress((info) => {
        const progress = Math.round((info.bytesOverall / (transfer.size || 1)) * 100)
        transfer.progress = Math.min(99, progress)
        if (!window.isDestroyed()) {
          window.webContents.send('sftp:transfer-status', transfer)
        }
      })
      await session.client.uploadFrom(localPath, remotePath)
      session.client.trackProgress()
    }

    transfer.status = 'completed'
    transfer.progress = 100
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
      window.webContents.send('sftp:refresh-directory', { remotePath })
    }
  } catch (err: any) {
    session.client.trackProgress()
    transfer.status = 'failed'
    transfer.error = err.message
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
    }
  }
}

// FTP Download background task
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

  try {
    if (isDirectory) {
      const localParent = path.dirname(localPath)
      if (!fs.existsSync(localParent)) {
        fs.mkdirSync(localParent, { recursive: true })
      }
      await session.client.downloadToDir(localPath, remotePath)
    } else {
      let size = 0
      try {
        size = await session.client.size(remotePath)
      } catch (e) {
        // ignore
      }
      transfer.size = size

      session.client.trackProgress((info) => {
        const progress = Math.round((info.bytesOverall / (size || 1)) * 100)
        transfer.progress = Math.min(99, progress)
        if (!window.isDestroyed()) {
          window.webContents.send('sftp:transfer-status', transfer)
        }
      })
      await session.client.downloadTo(localPath, remotePath)
      session.client.trackProgress()
    }

    transfer.status = 'completed'
    transfer.progress = 100
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
    }
  } catch (err: any) {
    session.client.trackProgress()
    transfer.status = 'failed'
    transfer.error = err.message
    if (!window.isDestroyed()) {
      window.webContents.send('sftp:transfer-status', transfer)
    }
  }
}
