<!--
	Vercel and Railway logos from svgl.app, drawn in currentColor so they follow the theme.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js'

	let { provider, class: className }: { provider: 'vercel' | 'railway' | 'github'; class?: string } = $props()

	const label = $derived({ vercel: 'Vercel', railway: 'Railway', github: 'GitHub' }[provider])
</script>

{#if provider === 'vercel'}
	<svg
		viewBox="0 0 256 222"
		class={cn('size-3.5 shrink-0', className)}
		fill="currentColor"
		role="img"
		aria-label={label}
	>
		<title>{label}</title>
		<path d="m128 0 128 221.705H0z" />
	</svg>
{:else if provider === 'railway'}
	<svg viewBox="0 0 1024 1024" class={cn('size-4 shrink-0', className)} fill="currentColor" role="img" aria-label={label}>
		<title>{label}</title>
		<path
			d="M4.8 438.2A520.7 520.7 0 000 489.7h777.8c-2.7-5.3-6.4-10-10-14.7-133-171.8-204.5-157-306.9-161.3-34-1.4-57.2-2-193-2-72.7 0-151.7.2-228.6.4A621 621 0 0015 386.3h398.6v51.9H4.8zm779.1 103.5H.4c.8 13.8 2.1 27.5 4 41h723.4c32.2 0 50.3-18.3 56.1-41zM45 724.3s120 294.5 466.5 299.7c207 0 385-123 465.9-299.7H45z"
		/>
		<path
			d="M511.5 0A512.2 512.2 0 0065.3 260.6l202.7-.2c158.4 0 164.2.6 195.2 2l19.1.6c66.7 2.3 148.7 9.4 213.2 58.2 35 26.5 85.6 85 115.7 126.5 27.9 38.5 35.9 82.8 17 125.2-17.5 39-55 62.2-100.4 62.2H16.7s4.2 18 10.6 37.8h970.6a510.4 510.4 0 0026.1-160.7A512.4 512.4 0 00511.5 0z"
		/>
	</svg>
{:else}
	<svg viewBox="0 0 1024 1024" class={cn('size-4 shrink-0', className)} fill="currentColor" role="img" aria-label={label}>
		<title>{label}</title>
		<path
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M512 0C229.12 0 0 229.12 0 512c0 226.56 146.56 417.92 350.08 485.76 25.6 4.48 35.2-10.88 35.2-24.32 0-12.16-.64-52.48-.64-95.36-128.64 23.68-161.92-31.36-172.16-60.16-5.76-14.72-30.72-60.16-52.48-72.32-17.92-9.6-43.52-33.28-.64-33.92 40.32-.64 69.12 37.12 78.72 52.48 46.08 77.44 119.68 55.68 149.12 42.24 4.48-33.28 17.92-55.68 32.64-68.48-113.92-12.8-232.96-56.96-232.96-252.8 0-55.68 19.84-101.76 52.48-137.6-5.12-12.8-23.04-65.28 5.12-135.68 0 0 42.88-13.44 140.8 52.48 40.96-11.52 84.48-17.28 128-17.28s87.04 5.76 128 17.28c97.92-66.56 140.8-52.48 140.8-52.48 28.16 70.4 10.24 122.88 5.12 135.68 32.64 35.84 52.48 81.28 52.48 137.6 0 196.48-119.68 240-233.6 252.8 18.56 16 34.56 46.72 34.56 94.72 0 68.48-.64 123.52-.64 140.8 0 13.44 9.6 29.44 35.2 24.32C877.44 929.92 1024 737.92 1024 512 1024 229.12 794.88 0 512 0"
		/>
	</svg>
{/if}
