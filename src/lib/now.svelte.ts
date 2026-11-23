import { createSubscriber } from 'svelte/reactivity'

let current = Date.now()

const subscribe = createSubscriber((update) => {
	const id = setInterval(() => {
		current = Date.now()
		update()
	}, 30_000)
	return () => clearInterval(id)
})

/** Current time that re-renders readers every 30s, for relative timestamps. */
export function now(): number {
	subscribe()
	return current
}
