import { command, query } from '$app/server'
import { fetchAllDeployments } from '#lib/server/deployments.js'
import { isActive } from '#lib/types.js'

const ACTIVE_INTERVAL_MS = 10_000
const IDLE_INTERVAL_MS = 60_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Streams the merged Vercel + Railway deployment list. Polls every 10s while anything is
 * queued or building, otherwise every 60s. Stops when no window is listening.
 */
export const getDeployments = query.live(async function* () {
	while (true) {
		const result = await fetchAllDeployments()
		yield result
		await sleep(result.deployments.some((d) => isActive(d.state)) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS)
	}
})

/** Restarts the live query so it fetches immediately. */
export const refreshDeployments = command(async () => {
	getDeployments().reconnect()
})
