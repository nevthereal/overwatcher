import { connectionStatuses, getDeployments } from '#lib/server/deployments.js'
import type { MenuBarItem, MenuBarSummary } from '#lib/types.js'
import { serviceLabel, type Deployment } from '#lib/types.js'
import type { RequestHandler } from './$types'

const toItem = (d: Deployment): MenuBarItem => ({
	key: d.key,
	provider: d.provider,
	name: serviceLabel(d) ? `${d.project} / ${d.service}` : d.project,
	environment: d.environment,
	isProduction: d.isProduction,
	state: d.state,
	createdAt: d.createdAt,
	message: d.commit?.message?.split('\n')[0],
	branch: d.commit?.branch,
	sha: d.commit?.sha,
	commitUrl: d.commit?.url,
	pr: d.pr,
	url: d.url,
	dashboardUrl: d.dashboardUrl
})

/**
 * Data for the macOS menu bar item (electron/menu-bar.ts): the newest deployment of every
 * project, service and environment. Only reachable with the app's session cookie.
 */
export const GET: RequestHandler = async ({ url }) => {
	const maxAge = Number(url.searchParams.get('maxAge') ?? 8_000)
	const connected = connectionStatuses().some((c) => c.connected && c.provider !== 'github')
	const result = await getDeployments(Number.isFinite(maxAge) ? maxAge : 8_000)

	const seen = new Set<string>()
	const targets: MenuBarItem[] = []
	for (const d of result.deployments) {
		const target = `${d.provider}:${d.scope}:${d.project}:${d.service ?? ''}:${d.environment}`
		if (seen.has(target)) continue
		seen.add(target)
		targets.push(toItem(d))
	}

	const summary: MenuBarSummary = { connected, fetchedAt: result.fetchedAt, errors: result.errors, targets }
	return Response.json(summary)
}
