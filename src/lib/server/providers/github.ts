import { createHash } from 'node:crypto'
import type { Deployment, PullRequestInfo } from '#lib/types.js'

const API = 'https://api.github.com'
const CONCURRENCY = 6

interface GhPull {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  merged_at: string | null
}

async function gh<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (res.status === 404 || res.status === 422) return null
  if (!res.ok) throw new GithubError(res.status, `GitHub API ${res.status}: ${res.statusText}`)
  return (await res.json()) as T
}

class GithubError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export async function verifyGithub(token: string): Promise<string> {
  const user = await gh<{ login: string }>(token, '/user')
  if (!user) throw new Error('GitHub token was rejected')
  return user.login
}

const toPr = (p: GhPull): PullRequestInfo => ({
  number: p.number,
  title: p.title,
  url: p.html_url,
  state: p.merged_at ? 'merged' : p.state
})

const TTL_MS = 10 * 60_000
const MAX_ENTRIES = 10_000

/**
 * PR lookups, keyed per token: what one user's token can see in a private repo must not show
 * up for another user. Entries expire so PR state (open → merged) stays reasonably fresh.
 */
const cache = new Map<string, { value: PullRequestInfo | null; at: number }>()

const tokenKey = (token: string) => createHash('sha256').update(token).digest('base64url').slice(0, 16)

async function cached(key: string, load: () => Promise<PullRequestInfo | null>): Promise<PullRequestInfo | null> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = await load()
  cache.delete(key)
  cache.set(key, { value, at: Date.now() })
  // Maps iterate in insertion order, so the first key is the oldest entry.
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  return value
}

function prForCommit(token: string, repo: string, sha: string): Promise<PullRequestInfo | null> {
  return cached(`${tokenKey(token)}:${repo}@${sha}`, async () => {
    const pulls = await gh<GhPull[]>(token, `/repos/${repo}/commits/${sha}/pulls`)
    return pulls && pulls.length > 0 ? toPr(pulls[0]) : null
  })
}

function prDetails(token: string, repo: string, n: number): Promise<PullRequestInfo | null> {
  return cached(`${tokenKey(token)}:${repo}#${n}`, async () => {
    const pull = await gh<GhPull>(token, `/repos/${repo}/pulls/${n}`)
    return pull ? toPr(pull) : null
  })
}

async function pool<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  })
  await Promise.all(workers)
}

/**
 * Fills in PR numbers, titles and states from GitHub. Mutates the given deployments, keeping
 * whatever it found before a failure. Deployments on non-GitHub repos are left untouched.
 *
 * Throws the first error after the lookups, so the feed can show it. A rejected token (401) or a
 * rate limit (403, 429) stops the remaining lookups, since they would fail the same way.
 */
export async function enrichWithGithub(token: string, deployments: Deployment[]): Promise<void> {
  const targets = deployments.filter((d) => d.commit?.repo && d.commit.url?.startsWith('https://github.com/'))
  let firstError: unknown
  let stop = false

  await pool(targets, async (d) => {
    if (stop) return
    const repo = d.commit!.repo!
    try {
      const pr = d.pr ? await prDetails(token, repo, d.pr.number) : await prForCommit(token, repo, d.commit!.sha)
      if (pr) d.pr = { ...d.pr, ...pr }
    } catch (err) {
      firstError ??= err
      if (err instanceof GithubError && [401, 403, 429].includes(err.status)) stop = true
    }
  })

  if (firstError instanceof GithubError && firstError.status === 401) {
    throw new Error('GitHub rejected the token. Reconnect GitHub on the Accounts page.')
  }
  if (firstError) throw firstError
}
