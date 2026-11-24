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

/** Per user: every open tab of that user shares one poller, and users never share results. */
const cache = new Map<string, { result?: FetchResult; inflight?: Promise<FetchResult> }>()

/**
 * Returns the user's cached result if it is younger than `maxAgeMs`, and joins an in-flight
 * fetch rather than starting another one.
 */
export function getDeployments(userId: string, maxAgeMs: number): Promise<FetchResult> {
	const entry = cache.get(userId) ?? {}
	cache.set(userId, entry)
	if (entry.result && Date.now() - entry.result.fetchedAt < maxAgeMs) return Promise.resolve(entry.result)
	entry.inflight ??= fetchAllDeployments(userId)
		.then((result) => (entry.result = result))
		.finally(() => (entry.inflight = undefined))
	return entry.inflight
}

/** Forces the user's next `getDeployments` call to hit the providers, e.g. after an account change. */
export function invalidateDeployments(userId: string): void {
	const entry = cache.get(userId)
	if (entry) entry.result = undefined
}

async function fetchAllDeployments(userId: string): Promise<FetchResult> {
	if (DEMO) return demoDeployments()

	const tokens = await getTokens(userId)
	const errors: ProviderError[] = []
	const deployments: Deployment[] = []
	const sources: [ProviderId, (token: string) => Promise<Deployment[]>][] = [
		['vercel', fetchVercelDeployments],
		['railway', fetchRailwayDeployments]
	]

	await Promise.all(
		sources.map(async ([provider, fetcher]) => {
			const token = tokens[provider]
			if (!token) return
			try {
				deployments.push(...(await fetcher(token)))
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
