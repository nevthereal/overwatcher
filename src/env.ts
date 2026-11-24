import { defineEnvVars } from '@sveltejs/kit/env'
import * as v from 'valibot'

/** Server-only configuration, checked when the app starts. See .env.example. */
export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Neon Postgres connection string (pooled).',
		schema: v.pipe(v.string('DATABASE_URL is not set'), v.url())
	},
	BETTER_AUTH_SECRET: {
		description: 'Signs session cookies. openssl rand -base64 32',
		schema: v.pipe(v.string('BETTER_AUTH_SECRET is not set'), v.minLength(32, 'BETTER_AUTH_SECRET must be at least 32 characters'))
	},
	BETTER_AUTH_URL: {
		description: 'Public URL of the app, e.g. https://overwatcher.example.com',
		schema: v.optional(v.pipe(v.string(), v.url()))
	},
	TOKEN_ENCRYPTION_KEY: {
		description: 'Encrypts stored provider tokens: 32 random bytes, base64. openssl rand -base64 32',
		schema: v.pipe(
			v.string('TOKEN_ENCRYPTION_KEY is not set'),
			v.check((s) => Buffer.from(s, 'base64').length === 32, 'TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded')
		)
	},
	DISABLE_SIGNUP: {
		description: 'Set to 1 to stop new sign-ups.',
		schema: (value) => value === '1' || value === 'true'
	},
	OVERWATCHER_DEMO: {
		description: 'Set to 1 to show fixture data instead of calling Vercel and Railway.',
		schema: (value) => value === '1'
	}
})
