<script lang="ts">
	import Logo from '#lib/components/logo.svelte'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()
</script>

<main class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
	<div class="flex items-center gap-2 text-lg font-semibold">
		<Logo class="h-5 w-auto" />
		Overwatcher
	</div>
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</main>
