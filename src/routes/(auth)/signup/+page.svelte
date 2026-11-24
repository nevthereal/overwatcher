<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Card from '#lib/components/ui/card/index.js'
	import { Input } from '#lib/components/ui/input/index.js'
	import { Label } from '#lib/components/ui/label/index.js'
	import { Spinner } from '#lib/components/ui/spinner/index.js'
	import { signUp } from '#lib/auth.remote.js'
</script>

<svelte:head><title>Create an account · Overwatcher</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-xl">Create an account</Card.Title>
		<Card.Description>Then connect Vercel and Railway with an access token each.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...signUp} class="grid gap-4">
			<div class="grid gap-2">
				<Label for="email">Email</Label>
				<Input id="email" {...signUp.fields.email.as('email')} autocomplete="email" required />
				{#each signUp.fields.email.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
			<div class="grid gap-2">
				<Label for="username">Username</Label>
				<Input id="username" {...signUp.fields.username.as('text')} autocomplete="username" autocapitalize="none" spellcheck={false} required />
				{#each signUp.fields.username.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
			<div class="grid gap-2">
				<Label for="password">Password</Label>
				<Input id="password" {...signUp.fields._password.as('password')} autocomplete="new-password" minlength={10} required />
				{#each signUp.fields._password.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-destructive">{issue.message}</p>
				{:else}
					<p class="text-sm text-muted-foreground">At least 10 characters.</p>
				{/each}
			</div>
			{#each signUp.fields.issues() ?? [] as issue (issue.message)}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
			<Button type="submit" class="w-full" disabled={!!signUp.pending}>
				{#if signUp.pending}<Spinner />Creating account…{:else}Create account{/if}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="justify-center text-sm text-muted-foreground">
		Already have one?&nbsp;<a href="/login" class="text-foreground underline underline-offset-4">Sign in</a>
	</Card.Footer>
</Card.Root>
