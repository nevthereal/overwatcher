import { and, eq } from 'drizzle-orm'
import type { ProviderId } from '#lib/types.js'
import { decrypt, encrypt } from './crypto.js'
import { db } from './db/index.js'
import { connection } from './db/schema.js'

/** Ties a ciphertext to its owner and provider, see `crypto.ts`. */
const aad = (userId: string, provider: ProviderId) => `connection:${userId}:${provider}`

export interface StoredConnection {
	provider: ProviderId
	accountName: string | null
	tokenHint: string | null
}

/** The user's connections, without their tokens. */
export function listConnections(userId: string): Promise<StoredConnection[]> {
	return db
		.select({ provider: connection.provider, accountName: connection.accountName, tokenHint: connection.tokenHint })
		.from(connection)
		.where(eq(connection.userId, userId))
}

/** Decrypted tokens by provider. Server-only: never return these to the browser. */
export async function getTokens(userId: string): Promise<Partial<Record<ProviderId, string>>> {
	const rows = await db
		.select({ provider: connection.provider, token: connection.token })
		.from(connection)
		.where(eq(connection.userId, userId))

	const tokens: Partial<Record<ProviderId, string>> = {}
	for (const row of rows) {
		try {
			tokens[row.provider] = decrypt(row.token, aad(userId, row.provider))
		} catch (err) {
			console.error(`Could not decrypt the ${row.provider} token of user ${userId}:`, err)
		}
	}
	return tokens
}

export async function saveConnection(userId: string, provider: ProviderId, token: string, accountName: string): Promise<void> {
	const values = {
		token: encrypt(token, aad(userId, provider)),
		tokenHint: token.slice(-4),
		accountName
	}
	await db
		.insert(connection)
		.values({ id: crypto.randomUUID(), userId, provider, ...values })
		.onConflictDoUpdate({ target: [connection.userId, connection.provider], set: values })
}

export async function removeConnection(userId: string, provider: ProviderId): Promise<void> {
	await db.delete(connection).where(and(eq(connection.userId, userId), eq(connection.provider, provider)))
}
