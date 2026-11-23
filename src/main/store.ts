import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from '../shared/types'

interface StoredCredential {
  /** Token, encrypted with the OS keychain via safeStorage (base64). */
  token: string
  account?: string
}

type CredentialFile = Partial<Record<ProviderId, StoredCredential>>

const file = () => join(app.getPath('userData'), 'credentials.json')

function readAll(): CredentialFile {
  try {
    if (!existsSync(file())) return {}
    return JSON.parse(readFileSync(file(), 'utf8')) as CredentialFile
  } catch {
    return {}
  }
}

function writeAll(data: CredentialFile): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(file(), JSON.stringify(data, null, 2), { mode: 0o600 })
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable, refusing to store the token in plain text.')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(value: string): string {
  return safeStorage.decryptString(Buffer.from(value, 'base64'))
}

export function getToken(provider: ProviderId): string | undefined {
  const entry = readAll()[provider]
  if (!entry) return undefined
  try {
    return decrypt(entry.token)
  } catch {
    return undefined
  }
}

export function getAccount(provider: ProviderId): string | undefined {
  return readAll()[provider]?.account
}

export function saveCredential(provider: ProviderId, token: string, account?: string): void {
  const data = readAll()
  data[provider] = { token: encrypt(token), account }
  writeAll(data)
}

export function removeCredential(provider: ProviderId): void {
  const data = readAll()
  delete data[provider]
  writeAll(data)
}
