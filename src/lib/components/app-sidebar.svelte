<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
	import KeyRoundIcon from '@lucide/svelte/icons/key-round'
	import LayersIcon from '@lucide/svelte/icons/layers'
	import LoaderIcon from '@lucide/svelte/icons/loader'
	import iconDark from '#lib/assets/icon-dark.png'
	import iconLight from '#lib/assets/icon-light.png'
	import * as Sidebar from '#lib/components/ui/sidebar/index.js'
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js'
	import StatusDot from '#lib/components/status-dot.svelte'
	import { getConnections } from '#lib/accounts.remote.js'
	import { getDeployments } from '#lib/deployments.remote.js'
	import { getFilters, projectKey, type EnvFilter, type ProviderFilter, type StatusFilter } from '#lib/filters.svelte.js'
	import { STATE_LABEL, timeAgo } from '#lib/format.js'
	import { now } from '#lib/now.svelte.js'
	import { isActive, type Deployment } from '#lib/types.js'

	const filters = getFilters()

	// `.current` instead of `await`: the sidebar renders immediately and fills in when data arrives.
	const deployments = $derived(getDeployments().current?.deployments ?? [])
	const connections = $derived(getConnections().current ?? [])

	const scoped = $derived(deployments.filter((d) => filters.matches(d, true)))
	const counts = $derived({
		all: scoped.length,
		active: scoped.filter((d) => isActive(d.state)).length,
		failed: scoped.filter((d) => d.state === 'error').length
	})

	const projects = $derived.by(() => {
		const map = new Map<string, { key: string; name: string; scope: string; provider: string; latest: Deployment }>()
		for (const d of deployments) {
			if (filters.provider !== 'all' && d.provider !== filters.provider) continue
			const key = projectKey(d)
			if (!map.has(key)) {
				map.set(key, { key, name: d.project, scope: d.scope, provider: d.provider === 'vercel' ? 'Vercel' : 'Railway', latest: d })
			}
		}
		return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
	})

	const onFeed = $derived(page.url.pathname === '/')

	function select(apply: () => void) {
		apply()
		if (!onFeed) void goto('/')
	}

	const statusItems: { value: StatusFilter; label: string; icon: typeof LayersIcon }[] = [
		{ value: 'all', label: 'All deployments', icon: LayersIcon },
		{ value: 'active', label: 'In progress', icon: LoaderIcon },
		{ value: 'failed', label: 'Failed', icon: CircleAlertIcon }
	]
</script>

<Sidebar.Root collapsible="none" class="h-svh border-r">
	<Sidebar.Header class="drag-region pt-11">
		<div class="flex items-center gap-2 px-2 font-semibold">
			<img src={iconLight} alt="" class="size-6 dark:hidden" />
			<img src={iconDark} alt="" class="hidden size-6 dark:block" />
			Overwatcher
		</div>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Status</Sidebar.GroupLabel>
			<Sidebar.Menu>
				{#each statusItems as item (item.value)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={onFeed && filters.status === item.value}
							onclick={() => select(() => (filters.status = item.value))}
						>
							<item.icon />
							<span>{item.label}</span>
						</Sidebar.MenuButton>
						<Sidebar.MenuBadge>{counts[item.value]}</Sidebar.MenuBadge>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>

		<Sidebar.Group>
			<Sidebar.GroupLabel>Platform</Sidebar.GroupLabel>
			<ToggleGroup.Root
				type="single"
				variant="outline"
				size="sm"
				class="w-full"
				bind:value={() => filters.provider, (v) => v && select(() => filters.setProvider(v as ProviderFilter))}
			>
				<ToggleGroup.Item value="all" class="flex-1">All</ToggleGroup.Item>
				<ToggleGroup.Item value="vercel" class="flex-1">Vercel</ToggleGroup.Item>
				<ToggleGroup.Item value="railway" class="flex-1">Railway</ToggleGroup.Item>
			</ToggleGroup.Root>
		</Sidebar.Group>

		<Sidebar.Group>
			<Sidebar.GroupLabel>Environment</Sidebar.GroupLabel>
			<ToggleGroup.Root
				type="single"
				variant="outline"
				size="sm"
				class="w-full"
				bind:value={() => filters.env, (v) => v && select(() => (filters.env = v as EnvFilter))}
			>
				<ToggleGroup.Item value="all" class="flex-1">All</ToggleGroup.Item>
				<ToggleGroup.Item value="production" class="flex-1">Prod</ToggleGroup.Item>
				<ToggleGroup.Item value="preview" class="flex-1">Preview</ToggleGroup.Item>
			</ToggleGroup.Root>
		</Sidebar.Group>

		<Sidebar.Group>
			<Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						size="sm"
						isActive={onFeed && filters.project === null}
						onclick={() => select(() => (filters.project = null))}
					>
						<span>All projects</span>
					</Sidebar.MenuButton>
					<Sidebar.MenuBadge>{projects.length}</Sidebar.MenuBadge>
				</Sidebar.MenuItem>
				{#each projects as p (p.key)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							size="sm"
							isActive={onFeed && filters.project === p.key}
							onclick={() => select(() => (filters.project = p.key))}
							title="{p.scope} · latest {STATE_LABEL[p.latest.state].toLowerCase()} {timeAgo(p.latest.createdAt, now())}"
						>
							<StatusDot state={p.latest.state} />
							<span>{p.name}</span>
						</Sidebar.MenuButton>
						<Sidebar.MenuBadge class="font-normal text-muted-foreground">{p.provider}</Sidebar.MenuBadge>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton isActive={page.url.pathname === '/accounts'}>
					{#snippet child({ props })}
						<a href="/accounts" {...props}>
							<KeyRoundIcon />
							<span>Accounts</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
				<Sidebar.MenuBadge class="gap-1">
					{#each connections as c (c.provider)}
						<span
							class={['size-1.5 rounded-full', c.connected ? 'bg-emerald-500' : 'bg-muted-foreground/30']}
							title="{c.provider}{c.account ? `: ${c.account}` : ''}"
						></span>
					{/each}
				</Sidebar.MenuBadge>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
