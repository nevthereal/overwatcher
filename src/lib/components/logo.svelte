<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements'

	/** The Overwatcher eye, without a backdrop. Takes the current text colour. */
	let { class: className, ...rest }: SVGAttributes<SVGSVGElement> = $props()
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 285" fill="currentColor" aria-hidden="true" class={className} {...rest}>
	<path
		d="M18 124Q10 124 10 114C12 62 121 10 260 10C399 10 508 62 510 114Q510 124 502 124L438 124C434 106 421 92 406 82C371 54 321 42 260 42C199 42 149 54 114 82C99 92 86 106 82 124Z"
	/>
	<path
		fill-rule="evenodd"
		d="M88 190a172 85 0 1 0 344 0a172 85 0 1 0-344 0ZM136 190a124 53 0 1 0 248 0a124 53 0 1 0-248 0Z"
	/>
	<ellipse cx="260" cy="190" rx="21" ry="31" />
</svg>
