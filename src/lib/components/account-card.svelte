<script lang="ts" module>
	import type { ProviderId } from '#lib/types.js'

	const INFO: Record<ProviderId, { name: string; tokenUrl: string; help: string; optional?: boolean }> = {
		vercel: {
			name: 'Vercel',
			tokenUrl: 'https://vercel.com/account/settings/tokens',
			help: 'Create a token scoped to the teams you want to watch. Every team it can access is included.'
		},
		railway: {
			name: 'Railway',
			tokenUrl: 'https://railway.com/account/tokens',
			help: 'Use an account token (no workspace selected) to see every workspace, or a workspace token for one.'
		},
		github: {
			name: 'GitHub',
			tokenUrl: 'https://github.com/settings/personal-access-tokens/new',
			help: 'Looks up the pull request behind each commit and fills in PR titles. Needs read access to Pull requests and Contents.',
			optional: true
		}
	}
</script>

<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import TerminalIcon from '@lucide/svelte/icons/terminal'
	import { toast } from 'svelte-sonner'
	import { Badge } from '#lib/components/ui/badge/index.js'
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Card from '#lib/components/ui/card/index.js'
	import { Input } from '#lib/components/ui/input/index.js'
	import { Spinner } from '#lib/components/ui/spinner/index.js'
	import StatusDot from '#lib/components/status-dot.svelte'
	import { connectAccount, connectGithubFromCli, disconnectAccount } from '#lib/accounts.remote.js'
	import type { ConnectionStatus } from '#lib/types.js'

	let { status }: { status: ConnectionStatus } = $props()

	const info = $derived(INFO[status.provider])
	const connect = $derived(connectAccount.for(status.provider))
	const disconnect = $derived(disconnectAccount.for(status.provider))

	let cliPending = $state(false)

	async function useGithubCli() {
		cliPending = true
		try {
			const account = await connectGithubFromCli()
			toast.success(`Connected GitHub as ${account}`)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		} finally {
			cliPending = false
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			{info.name}
			{#if info.optional}<Badge variant="secondary">Optional</Badge>{/if}
		</Card.Title>
		<Card.Description>
			{info.help}
			<a href={info.tokenUrl} target="_blank" rel="noreferrer" class="inline-flex items-center gap-0.5 text-foreground underline-offset-4 hover:underline">
				Create a token<ExternalLinkIcon class="size-3" />
			</a>
		</Card.Description>
		<Card.Action>
			{#if status.connected}
				<Badge variant="outline" class="gap-1.5"><StatusDot state="ready" />{status.account ?? 'Connected'}</Badge>
			{:else}
				<Badge variant="outline" class="text-muted-foreground">Not connected</Badge>
			{/if}
		</Card.Action>
	</Card.Header>

	<Card.Content>
		{#if status.connected}
			<form {...disconnect}>
				<input {...disconnect.fields.provider.as('hidden', status.provider)} />
				<Button type="submit" variant="outline" size="sm" disabled={!!disconnect.pending}>Disconnect</Button>
			</form>
			{#each disconnect.fields.allIssues() ?? [] as issue (issue.message)}
				<p class="mt-2 text-sm text-destructive">{issue.message}</p>
			{/each}
		{:else}
			<form
				class="flex gap-2"
				{...connect.enhance(async ({ element, submit }) => {
					if (await submit()) {
						element.reset()
						toast.success(`Connected ${info.name}`)
					}
				})}
			>
				<input {...connect.fields.provider.as('hidden', status.provider)} />
				<Input
					{...connect.fields.token.as('password')}
					placeholder="{info.name} token"
					autocomplete="off"
					spellcheck={false}
					class="select-text"
				/>
				<Button type="submit" disabled={!!connect.pending}>
					{#if connect.pending}<Spinner />Checking…{:else}Connect{/if}
				</Button>
				{#if status.provider === 'github'}
					<Button type="button" variant="outline" disabled={cliPending} onclick={useGithubCli} title="Uses `gh auth token`">
						{#if cliPending}<Spinner />{:else}<TerminalIcon />{/if}Use GitHub CLI
					</Button>
				{/if}
			</form>
			{#each connect.fields.allIssues() ?? [] as issue (issue.message)}
				<p class="mt-2 text-sm text-destructive select-text">{issue.message}</p>
			{/each}
		{/if}
	</Card.Content>
</Card.Root>
