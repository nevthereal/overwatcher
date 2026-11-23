import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from '#lib/types.js'
import { host } from './host.js'

interface StoredCredential {
	/** Token encrypted with the OS keychain, base64. */
	token: string
	account?: string
}

type CredentialFile = Partial<Record<ProviderId, StoredCredential>>

const file = () => join(host().dataDir, 'credentials.json')

function readAll(): CredentialFile {
	try {
		if (!existsSync(file())) return {}
		return JSON.parse(readFileSync(file(), 'utf8')) as CredentialFile
	} catch {
		return {}
	}
}

function writeAll(data: CredentialFile): void {
	mkdirSync(host().dataDir, { recursive: true })
	writeFileSync(file(), JSON.stringify(data, null, 2), { mode: 0o600 })
}

export function getToken(provider: ProviderId): string | undefined {
	const entry = readAll()[provider]
	if (!entry) return undefined
	try {
		return host().decrypt(entry.token)
	} catch {
		return undefined
	}
}

export function getAccount(provider: ProviderId): string | undefined {
	return readAll()[provider]?.account
}

export function saveCredential(provider: ProviderId, token: string, account?: string): void {
	const data = readAll()
	data[provider] = { token: host().encrypt(token), account }
	writeAll(data)
}

export function removeCredential(provider: ProviderId): void {
	const data = readAll()
	delete data[provider]
	writeAll(data)
}
