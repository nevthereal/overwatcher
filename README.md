<img src="assets/logo.svg" width="96" alt="">

# Overwatcher

A web app that shows your latest **Vercel** and **Railway** deployments in one feed, each with the commit, branch and pull request behind it.

- One chronological feed across every Vercel team and Railway workspace your tokens can see
- Commit message, branch, SHA, author and PR (number, title, open/merged state) on every deployment
- Filter by status (in progress / failed), platform, environment (production / preview) and project, or search across commits, branches and PRs
- "Latest only" view: the newest deployment per project, service and environment
- Refreshes every 60s, and every 10s while something is building
- Accounts with email or username and password; each account connects its own Vercel, Railway and GitHub tokens

## Connecting accounts

Create an account, then open **Accounts** in the bottom-left corner and paste a token for each platform. Tokens are verified against the platform, then stored in Postgres encrypted with AES-256-GCM. The key (`TOKEN_ENCRYPTION_KEY`) lives only in the server's environment, so a database dump alone doesn't expose them. Tokens are only ever sent to the platform they belong to, never back to the browser.

| Platform | Token | Notes |
| --- | --- | --- |
| Vercel | [vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens) | Deployments from your personal scope and every team the token can access. A token with an expiry date is a good idea. |
| Railway | [railway.com/account/tokens](https://railway.com/account/tokens) | Use an **account token** (no workspace selected) to see all workspaces, or a workspace token for one. Project tokens aren't supported. |
| GitHub (optional) | [Fine-grained token](https://github.com/settings/personal-access-tokens/new) with read access to *Pull requests* and *Contents* | Finds the PR behind each commit and fills in PR titles and state. Without it, PRs only show for Vercel preview deployments and Railway PR environments. |

## Development

You need a [Neon](https://neon.tech) Postgres database (`npx neon@latest claim create` makes a temporary one without an account).

```sh
bun install
cp .env.example .env   # fill in DATABASE_URL, BETTER_AUTH_SECRET and TOKEN_ENCRYPTION_KEY
bun run db:migrate     # create the tables
bun run dev            # http://localhost:5173
bun run demo           # same, with fixture data instead of real deployments
bun run check          # svelte-check
```

After changing `src/lib/server/db/schema.ts`, run `bun run db:generate` to write a migration into `drizzle/`, then `bun run db:migrate`.

## Deploying

`bun run build` produces a Node server in `build/` (`@sveltejs/adapter-node`). Run `bun run db:migrate` against the production database, then start it with `node build` and these environment variables:

| Variable | |
| --- | --- |
| `DATABASE_URL` | Neon connection string (pooled). `DATABASE_URL_UNPOOLED` is used for migrations if set. |
| `BETTER_AUTH_SECRET` | Random, at least 32 characters: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` / `ORIGIN` | The app's public URL, e.g. `https://overwatcher.example.com` |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64: `openssl rand -base64 32`. Losing it means everyone has to reconnect their accounts. |
| `DISABLE_SIGNUP` | `1` to stop new sign-ups, e.g. once your own account exists |

The app validates these when it starts (`src/env.ts`) and refuses to run if one is missing or malformed.

### How it fits together

Overwatcher is a SvelteKit 3 app ([async Svelte](https://svelte.dev/docs/svelte/await-expressions), [remote functions](https://svelte.dev/docs/kit/remote-functions), [shadcn-svelte](https://shadcn-svelte.com)) with [better-auth](https://better-auth.com) and [Drizzle](https://orm.drizzle.team) on Neon Postgres:

- **Auth:** `src/lib/server/auth.ts` configures better-auth with email/password and the username plugin. `src/hooks.server.ts` loads the session into `locals` and sends signed-out visitors to `/login`. Sign-in, sign-up and sign-out are remote `form`s in `src/lib/auth.remote.ts`.
- **Remote functions** in `src/lib/*.remote.ts` are the API. Each one that touches user data starts with `requireUser()` and only reads that user's rows. `getDeployments` is a `query.live` that polls Vercel and Railway on the server (every 10s while something is building, otherwise every 60s) and streams results to the page.
- **Tokens:** `src/lib/server/store.ts` keeps one row per user and platform in the `connection` table. `src/lib/server/crypto.ts` encrypts them with AES-256-GCM, bound to their owner, so a ciphertext copied onto another user's row doesn't decrypt.
- **Provider integrations** live in `src/lib/server/providers/`. Results are cached per user in `src/lib/server/deployments.ts`, so several open tabs share one poller.
