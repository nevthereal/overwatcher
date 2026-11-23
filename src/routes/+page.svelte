<script lang="ts">
	import FilterXIcon from '@lucide/svelte/icons/filter-x'
	import PlugIcon from '@lucide/svelte/icons/plug'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import SearchIcon from '@lucide/svelte/icons/search'
	import * as Alert from '#lib/components/ui/alert/index.js'
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Empty from '#lib/components/ui/empty/index.js'
	import * as InputGroup from '#lib/components/ui/input-group/index.js'
	import { Label } from '#lib/components/ui/label/index.js'
	import { Switch } from '#lib/components/ui/switch/index.js'
	import DeploymentRow from '#lib/components/deployment-row.svelte'
	import { getConnections } from '#lib/accounts.remote.js'
	import { getDeployments, refreshDeployments } from '#lib/deployments.remote.js'
	import { getFilters, groupByDay } from '#lib/filters.svelte.js'
	import { timeAgo } from '#lib/format.js'
	import { now } from '#lib/now.svelte.js'

	const MIN_FOCUS_REFRESH_MS = 15_000

	const filters = getFilters()

	const result = $derived(await getDeployments())
	const connections = $derived(await getConnections())

	const hasPlatform = $derived(connections.some((c) => c.connected && c.provider !== 'github'))
	const groups = $derived(groupByDay(filters.apply(result.deployments)))

	let refreshing = $state(false)

	async function refresh() {
		refreshing = true
		try {
			await refreshDeployments()
		} finally {
			refreshing = false
		}
	}

	// Can fire while the awaits above are still pending, so it reads `.current` rather than
	// the deriveds declared after them.
	function onfocus() {
		const fetchedAt = getDeployments().current?.fetchedAt
		const connected = getConnections().current?.some((c) => c.connected && c.provider !== 'github')
		if (connected && fetchedAt && Date.now() - fetchedAt > MIN_FOCUS_REFRESH_MS) void refresh()
	}

	function clearFilters() {
		filters.status = 'all'
		filters.env = 'all'
		filters.setProvider('all')
		filters.latestOnly = false
		filters.search = ''
	}
</script>

<svelte:window {onfocus} />

<header class="drag-region flex h-13 shrink-0 items-center gap-3 border-b px-4">
	<InputGroup.Root class="max-w-sm">
		<InputGroup.Addon><SearchIcon /></InputGroup.Addon>
		<InputGroup.Input placeholder="Search commits, branches, PRs, projects…" bind:value={filters.search} />
	</InputGroup.Root>
	<div class="flex items-center gap-2">
		<Switch id="latest-only" bind:checked={filters.latestOnly} />
		<Label for="latest-only" class="whitespace-nowrap text-muted-foreground" title="Only the newest deployment per project, service and environment">
			Latest only
		</Label>
	</div>
	<div class="flex-1"></div>
	{#if hasPlatform}
		<span class="text-xs whitespace-nowrap text-muted-foreground">Updated {timeAgo(result.fetchedAt, now())}</span>
	{/if}
	<Button variant="outline" size="icon-sm" onclick={refresh} disabled={refreshing || !hasPlatform} title="Refresh">
		<RefreshCwIcon class={[refreshing && 'animate-spin']} />
	</Button>
</header>

<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
	{#each result.errors as e (e.provider)}
		<Alert.Root variant="destructive" class="mt-3">
			<Alert.Title class="capitalize">{e.provider}</Alert.Title>
			<Alert.Description class="select-text">{e.message}</Alert.Description>
		</Alert.Root>
	{/each}

	{#if !hasPlatform}
		<Empty.Root class="mt-16">
			<Empty.Header>
				<Empty.Media variant="icon"><PlugIcon /></Empty.Media>
				<Empty.Title>Connect your deployment platforms</Empty.Title>
				<Empty.Description>
					Add a Vercel or Railway access token to see your latest deployments, with the commit and pull request
					behind each one. Tokens stay on this machine, encrypted with your system keychain.
				</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button href="/accounts">Connect accounts</Button>
			</Empty.Content>
		</Empty.Root>
	{:else if groups.length === 0}
		<Empty.Root class="mt-16">
			<Empty.Header>
				<Empty.Media variant="icon"><FilterXIcon /></Empty.Media>
				<Empty.Title>No deployments match</Empty.Title>
				<Empty.Description>Try a different search or loosen the filters.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button variant="outline" onclick={clearFilters}>Clear filters</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		{#each groups as group (group.label)}
			<section>
				<h3 class="sticky top-0 z-10 bg-background px-1 pt-4 pb-2 text-xs font-medium text-muted-foreground">
					{group.label}
				</h3>
				<div class="divide-y overflow-hidden rounded-lg border bg-card">
					{#each group.items as deployment (deployment.key)}
						<DeploymentRow {deployment} />
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
