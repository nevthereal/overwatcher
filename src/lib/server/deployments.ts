import type { ConnectionStatus, Deployment, FetchResult, ProviderError, ProviderId } from '#lib/types.js'
import { DEMO, demoConnections, demoDeployments } from './demo.js'
import { enrichWithGithub, verifyGithub } from './providers/github.js'
import { fetchRailwayDeployments, verifyRailway } from './providers/railway.js'
import { fetchVercelDeployments, verifyVercel } from './providers/vercel.js'
import { getTokens, listConnections, saveConnection } from './store.js'

export const PROVIDERS: ProviderId[] = ['vercel', 'railway', 'github']

const verifiers: Record<ProviderId, (token: string) => Promise<string>> = {
	vercel: verifyVercel,
	railway: verifyRailway,
	github: verifyGithub
}

/** Every provider with whether the user connected it. Tokens are not included. */
export async function connectionStatuses(userId: string): Promise<ConnectionStatus[]> {
	if (DEMO) return demoConnections
	const stored = await listConnections(userId)
	return PROVIDERS.map((provider) => {
		const row = stored.find((c) => c.provider === provider)
		return { provider, connected: !!row, account: row?.accountName ?? undefined, tokenHint: row?.tokenHint ?? undefined }
	})
}

/** Verifies the token against the provider, then stores it encrypted. Returns the account name. */
export async function connect(userId: string, provider: ProviderId, token: string): Promise<string> {
	const account = await verifiers[provider](token)
	await saveConnection(userId, provider, token, account)
	return account
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

interface CacheEntry {
	result?: FetchResult
	inflight?: Promise<FetchResult>
	/** Bumped by `invalidateDeployments`, so a fetch started before an account change is discarded. */
	generation: number
	lastUsed: number
}

/** Per user: every open tab of that user shares one poller, and users never share results. */
const cache = new Map<string, CacheEntry>()

/** Entries nobody asked for in this long are dropped. Open tabs poll at least once a minute. */
const IDLE_MS = 5 * 60_000
let lastPrune = 0

function prune(now: number): void {
	if (now - lastPrune < 60_000) return
	lastPrune = now
	for (const [userId, entry] of cache) {
		if (!entry.inflight && now - entry.lastUsed > IDLE_MS) cache.delete(userId)
	}
}

/**
 * Returns the user's cached result if it is younger than `maxAgeMs`, and joins an in-flight
 * fetch rather than starting another one.
 */
export function getDeployments(userId: string, maxAgeMs: number): Promise<FetchResult> {
	const now = Date.now()
	prune(now)
	let entry = cache.get(userId)
	if (!entry) cache.set(userId, (entry = { generation: 0, lastUsed: now }))
	entry.lastUsed = now

	if (entry.result && now - entry.result.fetchedAt < maxAgeMs) return Promise.resolve(entry.result)
	if (entry.inflight) return entry.inflight

	const e = entry
	const generation = e.generation
	const inflight = fetchAllDeployments(userId)
		.then((result) => {
			if (e.generation === generation) e.result = result
			return result
		})
		.finally(() => {
			if (e.inflight === inflight) e.inflight = undefined
		})
	e.inflight = inflight
	return inflight
}

/**
 * Forces the user's next `getDeployments` call to hit the providers, e.g. after an account change.
 * A fetch already running is detached: nobody new joins it and its result isn't cached.
 */
export function invalidateDeployments(userId: string): void {
	const entry = cache.get(userId)
	if (!entry) return
	entry.generation++
	entry.result = undefined
	entry.inflight = undefined
}

async function fetchAllDeployments(userId: string): Promise<FetchResult> {
	if (DEMO) return demoDeployments()

	const tokens = await getTokens(userId)
	const errors: ProviderError[] = []
	const deployments: Deployment[] = []
	const sources: [ProviderId, (token: string) => Promise<{ deployments: Deployment[]; warnings?: string[] }>][] = [
		['vercel', fetchVercelDeployments],
		['railway', async (token) => ({ deployments: await fetchRailwayDeployments(token) })]
	]

	await Promise.all(
		sources.map(async ([provider, fetcher]) => {
			const token = tokens[provider]
			if (!token) return
			try {
				const result = await fetcher(token)
				deployments.push(...result.deployments)
				for (const warning of result.warnings ?? []) errors.push({ provider, message: warning })
			} catch (err) {
				errors.push({ provider, message: message(err) })
			}
		})
	)

	deployments.sort((a, b) => b.createdAt - a.createdAt)

	if (tokens.github) {
		try {
			await enrichWithGithub(tokens.github, deployments)
		} catch (err) {
			errors.push({ provider: 'github', message: message(err) })
		}
	}

	return { deployments, errors, fetchedAt: Date.now() }
}
