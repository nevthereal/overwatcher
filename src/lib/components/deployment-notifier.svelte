<script lang="ts">
	import { getDeployments } from '#lib/deployments.remote.js'
	import { firstLine } from '#lib/format.js'
	import { isActive, type Deployment } from '#lib/types.js'

	// Last seen state per deployment. Not reactive on purpose: it's bookkeeping, not UI.
	const seen = new Map<string, Deployment['state']>()

	const deployments = $derived(getDeployments().current?.deployments)

	// Sends a system notification when a deployment we saw in progress finishes.
	$effect(() => {
		if (!deployments) return
		const firstRun = seen.size === 0
		for (const d of deployments) {
			const before = seen.get(d.key)
			seen.set(d.key, d.state)
			if (firstRun || !before || !isActive(before) || isActive(d.state)) continue
			if (d.state !== 'ready' && d.state !== 'error') continue
			const name = d.service ? `${d.project} / ${d.service}` : d.project
			const n = new Notification(`${name} ${d.state === 'ready' ? 'deployed' : 'failed'}`, {
				body: [d.environment, d.commit?.branch, firstLine(d.commit?.message)].filter(Boolean).join(' · '),
				silent: d.state === 'ready'
			})
			const target = d.dashboardUrl ?? d.url
			if (target) n.onclick = () => window.open(target, '_blank')
		}
	})
</script>
