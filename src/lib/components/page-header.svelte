<script lang="ts">
	import type { Snippet } from 'svelte'
	import * as Sidebar from '#lib/components/ui/sidebar/index.js'
	import { cn } from '#lib/utils.js'

	let { class: className, children }: { class?: string; children?: Snippet } = $props()
</script>

<!-- Top bar of every app page. On small screens it carries the button that opens the sidebar. -->
<header class={cn('flex h-13 shrink-0 items-center gap-3 border-b px-4', className)}>
	<Sidebar.Trigger class="-ml-1 md:hidden" />
	{@render children?.()}
</header>
