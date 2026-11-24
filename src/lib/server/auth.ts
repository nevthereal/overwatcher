import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { sveltekitCookies } from 'better-auth/svelte-kit'
import { username } from 'better-auth/plugins'
import { getRequestEvent } from '$app/server'
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL, DISABLE_SIGNUP } from '$app/env/private'
import { db, schema } from './db/index.js'

export const auth = betterAuth({
	secret: BETTER_AUTH_SECRET,
	baseURL: BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		// For a private deployment, set DISABLE_SIGNUP=1 once your own account exists.
		disableSignUp: DISABLE_SIGNUP
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24
	},
	plugins: [
		// Adds a unique username, so people can sign in with either it or their email.
		username(),
		// Must stay last: copies better-auth's Set-Cookie headers onto SvelteKit's response, so
		// remote functions that call `auth.api.*` can sign people in and out.
		sveltekitCookies(getRequestEvent)
	]
})

export type Session = typeof auth.$Infer.Session
