import { defineConfig } from 'drizzle-kit'

try {
	process.loadEnvFile()
} catch {
	// No .env file: rely on the environment.
}

// Migrations use the direct (unpooled) connection when Neon provides one.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url },
	strict: true,
	verbose: true
})
