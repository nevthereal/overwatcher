import { command, query } from '$app/server'
import { getDeployments as getForUser, invalidateDeployments } from '#lib/server/deployments.js'
import { requireUser } from '#lib/server/session.js'
import { isActive } from '#lib/types.js'

const ACTIVE_INTERVAL_MS = 10_000
const IDLE_INTERVAL_MS = 60_000
/** Other tabs of the same user poll the same cache, so accept a result one fetched moments ago. */
const MAX_CACHE_AGE_MS = 8_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Streams the user's merged Vercel + Railway deployment list. Polls every 10s while anything is
 * queued or building, otherwise every 60s. Stops when no tab is listening.
 */
export const getDeployments = query.live(async function* () {
	const { id } = requireUser()
	while (true) {
		const result = await getForUser(id, MAX_CACHE_AGE_MS)
		yield result
		await sleep(result.deployments.some((d) => isActive(d.state)) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS)
	}
})

/** Restarts the live query so it fetches immediately. */
export const refreshDeployments = command(async () => {
	invalidateDeployments(requireUser().id)
	getDeployments().reconnect()
})
