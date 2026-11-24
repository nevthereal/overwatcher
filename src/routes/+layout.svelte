<script lang="ts">
	import './layout.css'
	import { ModeWatcher } from 'mode-watcher'
	import { Toaster } from '#lib/components/ui/sonner/index.js'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()
</script>

<svelte:head>
	<title>Overwatcher</title>
</svelte:head>

<ModeWatcher />
<Toaster position="bottom-right" />

{@render children()}
