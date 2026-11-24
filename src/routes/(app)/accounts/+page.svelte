<script lang="ts">
	import AccountCard from '#lib/components/account-card.svelte'
	import PageHeader from '#lib/components/page-header.svelte'
	import { getConnections } from '#lib/accounts.remote.js'

	const connections = $derived(await getConnections())
</script>

<svelte:head><title>Accounts · Overwatcher</title></svelte:head>

<PageHeader class="md:px-6">
	<h1 class="font-semibold">Accounts</h1>
</PageHeader>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
		<p class="text-sm text-muted-foreground">
			Tokens are verified, then stored encrypted (AES-256-GCM) with a key that never leaves the server. Each one is
			only ever sent to the service it belongs to, and never back to your browser.
		</p>
		{#each connections as status (status.provider)}
			<AccountCard {status} />
		{/each}
	</div>
</div>
