import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { DATABASE_URL } from '$app/env/private'
import * as schema from './schema.js'

/** Neon over HTTP: stateless, no pool to manage. */
export const db = drizzle(neon(DATABASE_URL), { schema })
export { schema }
