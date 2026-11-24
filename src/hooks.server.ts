import { redirect } from '@sveltejs/kit'
import type { Handle } from '@sveltejs/kit/hooks'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/env'
import { auth } from '#lib/server/auth.js'

/** Pages you can open without an account. */
const AUTH_PAGES = ['/login', '/signup']

export const handle: Handle = async ({ event, resolve }) => {
	const session = building ? null : await auth.api.getSession({ headers: event.request.headers })
	event.locals.user = session?.user
	event.locals.session = session?.session

	// Remote functions check the session themselves (`requireUser`) and answer 401, and
	// /api/auth/* is better-auth's own API. Everything else is a page that needs a signed-in user.
	const { pathname, search } = event.url
	const isPage = !event.isRemoteRequest && !pathname.startsWith('/api/auth/')
	if (isPage && !building) {
		const onAuthPage = AUTH_PAGES.includes(pathname)
		if (!event.locals.user && !onAuthPage) {
			const redirectTo = pathname === '/' ? '' : `?redirectTo=${encodeURIComponent(pathname + search)}`
			redirect(303, `/login${redirectTo}`)
		}
		if (event.locals.user && onAuthPage) redirect(303, '/')
	}

	return svelteKitHandler({ event, resolve, auth, building })
}
