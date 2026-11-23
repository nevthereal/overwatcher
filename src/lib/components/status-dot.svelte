<script lang="ts">
	import type { DeploymentState } from '#lib/types.js'
	import { cn } from '#lib/utils.js'

	let { state, class: className }: { state: DeploymentState; class?: string } = $props()
</script>

<span
	class={cn(
		'inline-block size-2 shrink-0 rounded-full bg-muted-foreground/40',
		{
			'bg-emerald-500': state === 'ready',
			'bg-red-500': state === 'error',
			'animate-pulse bg-amber-500': state === 'building',
			'bg-transparent ring-[1.5px] ring-amber-500 ring-inset': state === 'queued',
			'bg-violet-500': state === 'sleeping'
		},
		className
	)}
></span>
