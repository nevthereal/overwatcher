<script lang="ts">
	import './layout.css'
	import favicon from '#lib/assets/favicon.svg'
	import { ModeWatcher } from 'mode-watcher'
	import AppSidebar from '#lib/components/app-sidebar.svelte'
	import DeploymentNotifier from '#lib/components/deployment-notifier.svelte'
	import * as Alert from '#lib/components/ui/alert/index.js'
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Sidebar from '#lib/components/ui/sidebar/index.js'
	import { Skeleton } from '#lib/components/ui/skeleton/index.js'
	import { Toaster } from '#lib/components/ui/sonner/index.js'
	import { Filters, setFilters } from '#lib/filters.svelte.js'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()

	const filters = new Filters()
	setFilters(filters)

	$effect(() => filters.save())
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Overwatcher</title>
</svelte:head>

<ModeWatcher />
<Toaster position="bottom-right" />
<DeploymentNotifier />

<Sidebar.Provider class="h-svh overflow-hidden">
	<AppSidebar />
	<Sidebar.Inset class="min-w-0 overflow-hidden">
		<svelte:boundary>
			{@render children()}

			{#snippet pending()}
				<div class="drag-region h-13 border-b"></div>
				<div class="space-y-3 p-4">
					<Skeleton class="h-4 w-24" />
					{#each { length: 5 }, i (i)}
						<Skeleton class="h-20 w-full" />
					{/each}
				</div>
			{/snippet}

			{#snippet failed(error, reset)}
				<div class="drag-region h-13 border-b"></div>
				<div class="p-4">
					<Alert.Root variant="destructive">
						<Alert.Title>Something went wrong</Alert.Title>
						<Alert.Description>
							<p>{error instanceof Error ? error.message : String(error)}</p>
							<Button variant="outline" size="sm" class="mt-2" onclick={reset}>Try again</Button>
						</Alert.Description>
					</Alert.Root>
				</div>
			{/snippet}
		</svelte:boundary>
	</Sidebar.Inset>
</Sidebar.Provider>
