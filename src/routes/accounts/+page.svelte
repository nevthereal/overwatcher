<script lang="ts">
	import AccountCard from '#lib/components/account-card.svelte'
	import { getConnections } from '#lib/accounts.remote.js'

	const connections = $derived(await getConnections())
</script>

<header class="drag-region flex h-13 shrink-0 items-center border-b px-6">
	<h1 class="font-semibold">Accounts</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto max-w-2xl space-y-4 p-6">
		<p class="text-sm text-muted-foreground">
			Tokens are verified, then stored on this machine only, encrypted with your system keychain. Each one is only
			ever sent to the service it belongs to.
		</p>
		{#each connections as status (status.provider)}
			<AccountCard {status} />
		{/each}
	</div>
</div>
