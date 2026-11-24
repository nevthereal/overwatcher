import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { TOKEN_ENCRYPTION_KEY } from '$app/env/private'

/**
 * Encryption for the provider tokens stored in the database: AES-256-GCM with a key that only
 * exists in the server's environment, so a database dump or backup alone doesn't expose them.
 *
 * Stored as `v1:<iv>:<ciphertext>:<tag>` (base64 parts). The version names the key, so a new key
 * can be added later as `v2` while old rows still decrypt. `aad` binds each ciphertext to the row
 * it belongs to: copying one user's ciphertext onto another user's row makes decryption fail.
 */

const CURRENT = 'v1'

/** Key versions. `src/env.ts` checks that each one is 32 bytes when the app starts. */
const KEYS: Record<string, Buffer> = {
	v1: Buffer.from(TOKEN_ENCRYPTION_KEY, 'base64')
}

function key(version: string): Buffer {
	const k = KEYS[version]
	if (!k) throw new Error(`Unknown encryption key version ${version}`)
	return k
}

export function encrypt(plain: string, aad: string): string {
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', key(CURRENT), iv)
	cipher.setAAD(Buffer.from(aad, 'utf8'))
	const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
	return [CURRENT, iv, ciphertext, cipher.getAuthTag()]
		.map((part) => (typeof part === 'string' ? part : part.toString('base64')))
		.join(':')
}

export function decrypt(stored: string, aad: string): string {
	const [version, iv, ciphertext, tag] = stored.split(':')
	if (!version || !iv || !ciphertext || !tag) throw new Error('Malformed encrypted value')
	const decipher = createDecipheriv('aes-256-gcm', key(version), Buffer.from(iv, 'base64'))
	decipher.setAAD(Buffer.from(aad, 'utf8'))
	decipher.setAuthTag(Buffer.from(tag, 'base64'))
	return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')
}
