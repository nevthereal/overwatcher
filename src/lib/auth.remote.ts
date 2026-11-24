import * as v from 'valibot'
import { invalid, redirect } from '@sveltejs/kit'
import { isAPIError } from 'better-auth/api'
import { form, getRequestEvent, query } from '$app/server'
import { auth } from '#lib/server/auth.js'

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Only same-site paths, so `?redirectTo=` can't send people elsewhere. */
function safeRedirect(to: string | undefined) {
	return to && to.startsWith('/') && !to.startsWith('//') ? to : '/'
}

/** The signed-in user, or null. Only fields the UI needs. */
export const getUser = query(async () => {
	const { user } = getRequestEvent().locals
	if (!user) return null
	return { name: user.displayUsername || user.username || user.name, email: user.email }
})

export const signIn = form(
	v.object({
		/** Email or username. */
		identifier: v.pipe(v.string(), v.trim(), v.nonEmpty('Enter your email or username')),
		_password: v.pipe(v.string(), v.nonEmpty('Enter your password')),
		redirectTo: v.optional(v.string())
	}),
	async ({ identifier, _password: password, redirectTo }) => {
		const { headers } = getRequestEvent().request
		try {
			if (identifier.includes('@')) {
				await auth.api.signInEmail({ body: { email: identifier, password }, headers })
			} else {
				await auth.api.signInUsername({ body: { username: identifier, password }, headers })
			}
		} catch (err) {
			// Same message either way, so the form doesn't reveal which accounts exist.
			if (isAPIError(err) && (err.status === 'UNAUTHORIZED' || err.statusCode === 401)) {
				invalid('Wrong email, username or password')
			}
			invalid(message(err))
		}
		redirect(303, safeRedirect(redirectTo))
	}
)

export const signUp = form(
	v.object({
		email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Enter a valid email address')),
		username: v.pipe(
			v.string(),
			v.trim(),
			v.minLength(3, 'At least 3 characters'),
			v.maxLength(30, 'At most 30 characters'),
			v.regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, underscores and dots only')
		),
		_password: v.pipe(v.string(), v.minLength(10, 'At least 10 characters'), v.maxLength(128, 'At most 128 characters'))
	}),
	async ({ email, username, _password: password }, issue) => {
		const { headers } = getRequestEvent().request
		try {
			await auth.api.signUpEmail({ body: { email, username, password, name: username }, headers })
		} catch (err) {
			if (isAPIError(err)) {
				const code = (err.body as { code?: string } | undefined)?.code
				if (code === 'USERNAME_IS_ALREADY_TAKEN') invalid(issue.username('That username is taken'))
				if (code?.startsWith('USER_ALREADY_EXISTS')) invalid(issue.email('An account with this email already exists'))
				if (code === 'INVALID_USERNAME') invalid(issue.username('That username is not allowed'))
				if (code === 'EMAIL_PASSWORD_SIGN_UP_DISABLED') invalid('Sign-up is disabled on this server')
			}
			invalid(message(err))
		}
		redirect(303, '/accounts')
	}
)

/** The page reloads to /login afterwards, so nothing of the previous session stays in memory. */
export const signOut = form(async () => {
	const { headers } = getRequestEvent().request
	await auth.api.signOut({ headers })
})
