import type { ConnectionStatus, Deployment, FetchResult, ProviderError, ProviderId } from '#lib/types.js'
import { demoConnections, demoDeployments } from './demo.js'
import { host } from './host.js'
import { enrichWithGithub, verifyGithub } from './providers/github.js'
import { fetchRailwayDeployments, verifyRailway } from './providers/railway.js'
import { fetchVercelDeployments, verifyVercel } from './providers/vercel.js'
import { getAccount, getToken, saveCredential } from './store.js'

export const PROVIDERS: ProviderId[] = ['vercel', 'railway', 'github']

const verifiers: Record<ProviderId, (token: string) => Promise<string>> = {
	vercel: verifyVercel,
	railway: verifyRailway,
	github: verifyGithub
}

export function connectionStatuses(): ConnectionStatus[] {
	if (host().demo) return demoConnections
	return PROVIDERS.map((provider) => {
		const connected = !!getToken(provider)
		return { provider, connected, account: connected ? getAccount(provider) : undefined }
	})
}

/** Verifies the token against the provider, then stores it. Returns the account name. */
export async function connect(provider: ProviderId, token: string): Promise<string> {
	const account = await verifiers[provider](token)
	saveCredential(provider, token, account)
	return account
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export async function fetchAllDeployments(): Promise<FetchResult> {
	if (host().demo) return demoDeployments()

	const errors: ProviderError[] = []
	const deployments: Deployment[] = []
	const sources: [ProviderId, (token: string) => Promise<Deployment[]>][] = [
		['vercel', fetchVercelDeployments],
		['railway', fetchRailwayDeployments]
	]

	await Promise.all(
		sources.map(async ([provider, fetcher]) => {
			const token = getToken(provider)
			if (!token) return
			try {
				deployments.push(...(await fetcher(token)))
			} catch (err) {
				errors.push({ provider, message: message(err) })
			}
		})
	)

	deployments.sort((a, b) => b.createdAt - a.createdAt)

	const ghToken = getToken('github')
	if (ghToken) {
		try {
			await enrichWithGithub(ghToken, deployments)
		} catch (err) {
			errors.push({ provider: 'github', message: message(err) })
		}
	}

	return { deployments, errors, fetchedAt: Date.now() }
}
