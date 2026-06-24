import Database from 'better-sqlite3'
import { app, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

export interface Connection {
  id?: number
  name: string
  host: string
  port: number
  username: string
  auth_type: 'password' | 'key'
  password?: string
  private_key?: string
  favorite: number // 0 or 1
  protocol?: 'ssh' | 'ftp'
  created_at?: string
  last_connected?: string
}

let db: Database.Database
let sessionKey: Buffer | null = null

// Initialize database
export function initDB(): void {
  const appDataPath = app.getPath('userData')
  const oldDbDir = join(appDataPath, 'PromSSH')
  const newDbDir = join(appDataPath, 'PromHub')

  // Automatic data migration from old directory to new directory
  if (fs.existsSync(oldDbDir) && !fs.existsSync(newDbDir)) {
    try {
      fs.mkdirSync(newDbDir, { recursive: true })
      const oldDbPath = join(oldDbDir, 'database.db')
      const newDbPath = join(newDbDir, 'database.db')
      if (fs.existsSync(oldDbPath)) {
        fs.copyFileSync(oldDbPath, newDbPath)
        console.log('Successfully migrated database from PromSSH to PromHub.')
      }
    } catch (e) {
      console.error('Database migration failed:', e)
    }
  }

  if (!fs.existsSync(newDbDir)) {
    fs.mkdirSync(newDbDir, { recursive: true })
  }

  const dbPath = join(newDbDir, 'database.db')
  db = new Database(dbPath)

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      password_encrypted TEXT,
      private_key_encrypted TEXT,
      favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected DATETIME
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Run protocol migration
  try {
    db.prepare("ALTER TABLE connections ADD COLUMN protocol TEXT DEFAULT 'ssh'").run()
  } catch (e) {
    // Column already exists
  }
}

// Check if master password exists in settings
export function hasMasterPassword(): boolean {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_password_hash') as { value: string } | undefined
  return !!row
}

// Derive encryption key and hash from master password
function deriveKey(password: string, salt: string): { key: Buffer; hash: string } {
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 32 + 32, 'sha256')
  const key = derived.subarray(0, 32)
  const hash = derived.subarray(32, 64).toString('hex')
  return { key, hash }
}

// Set master password for the first time
export function setMasterPassword(password: string): boolean {
  try {
    const salt = crypto.randomBytes(16).toString('hex')
    const { key, hash } = deriveKey(password, salt)

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('master_password_salt', salt)
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('master_password_hash', hash)

    sessionKey = key
    return true
  } catch (err) {
    console.error('Failed to set master password:', err)
    return false
  }
}

// Unlock DB with master password
export function unlockDatabase(password: string): boolean {
  try {
    const saltRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_password_salt') as { value: string } | undefined
    const hashRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_password_hash') as { value: string } | undefined

    if (!saltRow || !hashRow) {
      return false
    }

    const { key, hash } = deriveKey(password, saltRow.value)

    if (hash === hashRow.value) {
      sessionKey = key
      return true
    }
    return false
  } catch (err) {
    console.error('Failed to unlock database:', err)
    return false
  }
}

// Lock database (clear key in memory)
export function lockDatabase(): void {
  sessionKey = null
}

// Check if database is unlocked
export function isUnlocked(): boolean {
  return sessionKey !== null
}

// Helper to encrypt
function encryptText(text: string): string {
  if (!sessionKey) throw new Error('Database is locked')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', sessionKey, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// Helper to decrypt
function decryptText(encryptedText: string): string {
  if (!sessionKey) throw new Error('Database is locked')
  const parts = encryptedText.split(':')
  if (parts.length !== 2) throw new Error('Invalid encrypted format')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv('aes-256-cbc', sessionKey, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Get all connections
export function getConnections(): Connection[] {
  // If database is locked, we only return non-sensitive fields
  const rows = db.prepare('SELECT id, name, host, port, username, auth_type, favorite, created_at, last_connected, password_encrypted, private_key_encrypted, protocol FROM connections ORDER BY favorite DESC, name ASC').all() as any[]

  return rows.map((row) => {
    const conn: Connection = {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      username: row.username,
      auth_type: row.auth_type,
      favorite: row.favorite,
      protocol: row.protocol || 'ssh',
      created_at: row.created_at,
      last_connected: row.last_connected
    }

    if (isUnlocked()) {
      if (row.password_encrypted) {
        try {
          conn.password = decryptText(row.password_encrypted)
        } catch (e) {
          conn.password = ''
        }
      }
      if (row.private_key_encrypted) {
        try {
          conn.private_key = decryptText(row.private_key_encrypted)
        } catch (e) {
          conn.private_key = ''
        }
      }
    }
    return conn
  })
}

// Add a connection
export function addConnection(conn: Connection): number | bigint {
  if (!isUnlocked()) throw new Error('Database is locked')

  const passwordEncrypted = conn.password ? encryptText(conn.password) : null
  const privateKeyEncrypted = conn.private_key ? encryptText(conn.private_key) : null

  const info = db.prepare(`
    INSERT INTO connections (name, host, port, username, auth_type, password_encrypted, private_key_encrypted, favorite, protocol)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conn.name,
    conn.host,
    conn.port,
    conn.username,
    conn.auth_type,
    passwordEncrypted,
    privateKeyEncrypted,
    conn.favorite,
    conn.protocol || 'ssh'
  )

  return info.lastInsertRowid
}

// Update a connection
export function updateConnection(id: number, conn: Connection): boolean {
  if (!isUnlocked()) throw new Error('Database is locked')

  const passwordEncrypted = conn.password ? encryptText(conn.password) : null
  const privateKeyEncrypted = conn.private_key ? encryptText(conn.private_key) : null

  const info = db.prepare(`
    UPDATE connections
    SET name = ?, host = ?, port = ?, username = ?, auth_type = ?, password_encrypted = ?, private_key_encrypted = ?, favorite = ?, protocol = ?
    WHERE id = ?
  `).run(
    conn.name,
    conn.host,
    conn.port,
    conn.username,
    conn.auth_type,
    passwordEncrypted,
    privateKeyEncrypted,
    conn.favorite,
    conn.protocol || 'ssh',
    id
  )

  return info.changes > 0
}

// Update last connected timestamp
export function updateLastConnected(id: number): boolean {
  const info = db.prepare('UPDATE connections SET last_connected = CURRENT_TIMESTAMP WHERE id = ?').run(id)
  return info.changes > 0
}

// Delete connection
export function deleteConnection(id: number): boolean {
  const info = db.prepare('DELETE FROM connections WHERE id = ?').run(id)
  return info.changes > 0
}

// Get setting
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

// Save setting
export function saveSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

// Register all DB IPC channels
export function registerDBIPC(): void {
  ipcMain.handle('db:has-master-password', () => {
    return hasMasterPassword()
  })

  ipcMain.handle('db:set-master-password', (_, { password }) => {
    return setMasterPassword(password)
  })

  ipcMain.handle('db:unlock', (_, { password }) => {
    return unlockDatabase(password)
  })

  ipcMain.handle('db:lock', () => {
    lockDatabase()
    return true
  })

  ipcMain.handle('db:is-unlocked', () => {
    return isUnlocked()
  })

  ipcMain.handle('db:get-connections', () => {
    try {
      return getConnections()
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('db:add-connection', (_, { conn }) => {
    try {
      return addConnection(conn)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('db:update-connection', (_, { id, conn }) => {
    try {
      return updateConnection(id, conn)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('db:delete-connection', (_, { id }) => {
    try {
      return deleteConnection(id)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('db:update-last-connected', (_, { id }) => {
    try {
      return updateLastConnected(id)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('db:get-setting', (_, { key }) => {
    return getSetting(key)
  })

  ipcMain.handle('db:save-setting', (_, { key, value }) => {
    saveSetting(key, value)
    return true
  })
}

