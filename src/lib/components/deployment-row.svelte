<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import GitBranchIcon from '@lucide/svelte/icons/git-branch'
	import GitPullRequestIcon from '@lucide/svelte/icons/git-pull-request'
	import GitMergeIcon from '@lucide/svelte/icons/git-merge'
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text'
	import { Badge } from '#lib/components/ui/badge/index.js'
	import { Button } from '#lib/components/ui/button/index.js'
	import ProviderLogo from '#lib/components/provider-logo.svelte'
	import StatusDot from '#lib/components/status-dot.svelte'
	import { duration, firstLine, STATE_LABEL, timeAgo } from '#lib/format.js'
	import { now } from '#lib/now.svelte.js'
	import { serviceLabel, type Deployment } from '#lib/types.js'
	import { cn } from '#lib/utils.js'

	let { deployment: d }: { deployment: Deployment } = $props()

	const buildTime = $derived(
		d.state === 'ready' || d.state === 'error' ? duration(d.createdAt, d.updatedAt) : undefined
	)
	const author = $derived(d.commit?.author ?? d.creator)
	const service = $derived(serviceLabel(d))
	const chip = 'inline-flex max-w-72 items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground'
</script>

<article class="group/row grid grid-cols-[1rem_1fr_auto] gap-x-3 px-4 py-3 hover:bg-muted/40">
	<div class="pt-1.5" title="{STATE_LABEL[d.state]} ({d.rawStatus})">
		<StatusDot state={d.state} />
	</div>

	<div class="min-w-0">
		<div class="flex flex-wrap items-center gap-1.5">
			<ProviderLogo provider={d.provider} class="mr-0.5" />
			<span class="font-semibold">{d.project}</span>
			{#if service}
				<span class="text-muted-foreground">/ {service}</span>
			{/if}
			<Badge
				variant={d.isProduction ? 'default' : 'secondary'}
				class={cn(d.isProduction && 'bg-sky-500/15 text-sky-700 dark:text-sky-300')}
			>
				{d.environment}
			</Badge>
			<span
				class={cn('text-xs text-muted-foreground', {
					'text-emerald-600 dark:text-emerald-400': d.state === 'ready',
					'text-red-600 dark:text-red-400': d.state === 'error',
					'text-amber-600 dark:text-amber-400': d.state === 'building' || d.state === 'queued'
				})}
			>
				{STATE_LABEL[d.state]}
			</span>
		</div>

		<p class={cn('mt-0.5 truncate select-text', !d.commit && 'text-muted-foreground')} title={d.commit?.message}>
			{d.commit ? (firstLine(d.commit.message) ?? 'No commit message') : 'Deployed without a linked commit'}
		</p>

		<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
			{#if d.pr}
				{@const PrIcon = d.pr.state === 'merged' ? GitMergeIcon : GitPullRequestIcon}
				<svelte:element
					this={d.pr.url ? 'a' : 'span'}
					href={d.pr.url}
					target="_blank"
					rel="noreferrer"
					title={d.pr.title}
					class={cn(chip, 'max-w-96 hover:text-foreground', {
						'text-emerald-600 dark:text-emerald-400': !d.pr.state || d.pr.state === 'open',
						'text-violet-600 dark:text-violet-400': d.pr.state === 'merged',
						'text-red-600 dark:text-red-400': d.pr.state === 'closed'
					})}
				>
					<PrIcon class="size-3 shrink-0" />#{d.pr.number}
					{#if d.pr.title}<span class="truncate text-muted-foreground">{d.pr.title}</span>{/if}
				</svelte:element>
			{/if}
			{#if d.commit?.branch}
				<span class={chip} title={d.commit.branch}><GitBranchIcon class="size-3 shrink-0" />{d.commit.branch}</span>
			{/if}
			{#if d.commit}
				<svelte:element
					this={d.commit.url ? 'a' : 'span'}
					href={d.commit.url}
					target="_blank"
					rel="noreferrer"
					class={cn(chip, 'font-mono text-[11px] hover:text-foreground')}
					title={d.commit.repo ? `${d.commit.repo}@${d.commit.sha}` : d.commit.sha}
				>
					{d.commit.sha.slice(0, 7)}
				</svelte:element>
			{/if}
			{#if d.commit?.repo}
				<span class="text-muted-foreground">{d.commit.repo}</span>
			{/if}
			{#if author}
				<span class="inline-flex items-center gap-1.5 text-muted-foreground">
					{#if d.commit?.authorAvatar}
						<img src={d.commit.authorAvatar} alt="" class="size-4 rounded-full" />
					{/if}
					{author}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
		<time class="tabular-nums" title={new Date(d.createdAt).toLocaleString()}>{timeAgo(d.createdAt, now())}</time>
		{#if buildTime}<span>{buildTime}</span>{/if}
		<div class="mt-1 flex gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
			{#if d.url && d.state !== 'removed'}
				<Button variant="outline" size="xs" href={d.url} target="_blank" rel="noreferrer" title={d.url}>
					<ExternalLinkIcon />Visit
				</Button>
			{/if}
			{#if d.dashboardUrl}
				<Button variant="outline" size="xs" href={d.dashboardUrl} target="_blank" rel="noreferrer">
					<ScrollTextIcon />{d.provider === 'vercel' ? 'Inspect' : 'Logs'}
				</Button>
			{/if}
		</div>
	</div>
</article>
