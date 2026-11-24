import { error } from '@sveltejs/kit'
import { getRequestEvent } from '$app/server'

/** The signed-in user, set by `hooks.server.ts`. Every remote function that touches user data starts here. */
export function requireUser() {
	const { user } = getRequestEvent().locals
	if (!user) error(401, 'Sign in to continue')
	return user
}
