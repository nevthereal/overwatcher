<script lang="ts">
	import { isHttpError } from '@sveltejs/kit'
	import AppSidebar from '#lib/components/app-sidebar.svelte'
	import PageHeader from '#lib/components/page-header.svelte'
	import * as Alert from '#lib/components/ui/alert/index.js'
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Sidebar from '#lib/components/ui/sidebar/index.js'
	import { Skeleton } from '#lib/components/ui/skeleton/index.js'
	import { Filters, setFilters } from '#lib/filters.svelte.js'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()

	const filters = new Filters()
	setFilters(filters)

	$effect(() => filters.save())
</script>

<Sidebar.Provider class="h-svh overflow-hidden">
	<AppSidebar />
	<Sidebar.Inset class="min-w-0 overflow-hidden">
		<svelte:boundary>
			{@render children()}

			{#snippet pending()}
				<PageHeader />
				<div class="space-y-3 p-4">
					<Skeleton class="h-4 w-24" />
					{#each { length: 5 }, i (i)}
						<Skeleton class="h-20 w-full" />
					{/each}
				</div>
			{/snippet}

			{#snippet failed(error, reset)}
				<PageHeader />
				<div class="p-4">
					{#if isHttpError(error, 401)}
						<Alert.Root>
							<Alert.Title>You've been signed out</Alert.Title>
							<Alert.Description>
								<Button href="/login" size="sm" class="mt-2" data-sveltekit-reload>Sign in again</Button>
							</Alert.Description>
						</Alert.Root>
					{:else}
						<Alert.Root variant="destructive">
							<Alert.Title>Something went wrong</Alert.Title>
							<Alert.Description>
								<p>{error instanceof Error ? error.message : isHttpError(error) ? error.body.message : String(error)}</p>
								<Button variant="outline" size="sm" class="mt-2" onclick={reset}>Try again</Button>
							</Alert.Description>
						</Alert.Root>
					{/if}
				</div>
			{/snippet}
		</svelte:boundary>
	</Sidebar.Inset>
</Sidebar.Provider>
