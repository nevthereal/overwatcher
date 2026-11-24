import { untrack } from 'svelte'
import { getDeployments } from '#lib/deployments.remote.js'
import { isActive } from '#lib/types.js'

const ACTIVE_INTERVAL_MS = 10_000
const IDLE_INTERVAL_MS = 60_000

/**
 * Refreshes the deployment list every 10s while anything is queued or building, otherwise every
 * 60s. Skips refreshes while the tab is hidden; the feed refreshes when it becomes visible again.
 * Call once, from a component's script.
 */
export function pollDeployments(): void {
	const deployments = getDeployments()

	$effect(() => {
		let timer: ReturnType<typeof setTimeout>

		const delay = () =>
			untrack(() => deployments.current?.deployments.some((d) => isActive(d.state)))
				? ACTIVE_INTERVAL_MS
				: IDLE_INTERVAL_MS

		const tick = async () => {
			if (document.visibilityState === 'visible') {
				// A failed refresh keeps the last result; the next tick tries again.
				await deployments.refresh().catch(() => {})
			}
			timer = setTimeout(tick, delay())
		}

		timer = setTimeout(tick, delay())
		return () => clearTimeout(timer)
	})
}
