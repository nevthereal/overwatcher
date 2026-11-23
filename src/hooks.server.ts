import type { Handle } from '@sveltejs/kit/hooks'

export const SESSION_COOKIE = 'overwatcher_session'

/**
 * The server listens on 127.0.0.1 only, but other local processes (or a web page using DNS
 * rebinding) could still reach it. Only the Electron window has the per-launch session cookie.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const host = globalThis.__overwatcherHost
	if (!host) {
		return new Response('Overwatcher must be started through its Electron shell (bun run dev).', { status: 503 })
	}
	if (event.cookies.get(SESSION_COOKIE) !== host.secret) {
		return new Response('Forbidden', { status: 403 })
	}
	return resolve(event)
}
