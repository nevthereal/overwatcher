<script lang="ts">
	import { page } from '$app/state'
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Card from '#lib/components/ui/card/index.js'
	import { Input } from '#lib/components/ui/input/index.js'
	import { Label } from '#lib/components/ui/label/index.js'
	import { Spinner } from '#lib/components/ui/spinner/index.js'
	import { signIn } from '#lib/auth.remote.js'

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/')
</script>

<svelte:head><title>Sign in · Overwatcher</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-xl">Sign in</Card.Title>
		<Card.Description>Your deployments across Vercel and Railway, in one feed.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...signIn} class="grid gap-4">
			<input {...signIn.fields.redirectTo.as('hidden', redirectTo)} />
			<div class="grid gap-2">
				<Label for="identifier">Email or username</Label>
				<Input id="identifier" {...signIn.fields.identifier.as('text')} autocomplete="username" autocapitalize="none" spellcheck={false} required />
				{#each signIn.fields.identifier.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
			<div class="grid gap-2">
				<Label for="password">Password</Label>
				<Input id="password" {...signIn.fields._password.as('password')} autocomplete="current-password" required />
				{#each signIn.fields._password.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
			{#each signIn.fields.issues() ?? [] as issue (issue.message)}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
			<Button type="submit" class="w-full" disabled={!!signIn.pending}>
				{#if signIn.pending}<Spinner />Signing in…{:else}Sign in{/if}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="justify-center text-sm text-muted-foreground">
		No account yet?&nbsp;<a href="/signup" class="text-foreground underline underline-offset-4">Create one</a>
	</Card.Footer>
</Card.Root>
