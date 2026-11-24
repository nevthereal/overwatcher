import { command, query } from '$app/server'
import { getDeployments as getForUser, invalidateDeployments } from '#lib/server/deployments.js'
import { requireUser } from '#lib/server/session.js'

/** Other tabs of the same user may have fetched moments ago; reuse that rather than hit the providers again. */
const MAX_CACHE_AGE_MS = 8_000

/**
 * The user's merged Vercel + Railway deployment list. A plain query rather than a live stream, so
 * it fits serverless hosting: the browser refreshes it on a timer (see `poll-deployments.svelte.ts`).
 */
export const getDeployments = query(async () => getForUser(requireUser().id, MAX_CACHE_AGE_MS))

/** Skips the cache and fetches from the providers now. */
export const refreshDeployments = command(async () => {
	invalidateDeployments(requireUser().id)
	await getDeployments().refresh()
})
