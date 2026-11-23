import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
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
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
  return (await res.json()) as T
}

export async function verifyGithub(token: string): Promise<string> {
  const user = await gh<{ login: string }>(token, '/user')
  if (!user) throw new Error('GitHub token was rejected')
  return user.login
}

/** Reads the token from an installed and logged-in GitHub CLI. */
export function tokenFromGhCli(): Promise<string> {
  const candidates = ['/opt/homebrew/bin/gh', '/usr/local/bin/gh', '/usr/bin/gh']
  const bin = candidates.find((p) => existsSync(p)) ?? 'gh'
  return new Promise((resolve, reject) => {
    execFile(bin, ['auth', 'token'], { timeout: 5000 }, (err, stdout) => {
      const token = stdout?.trim()
      if (err || !token) reject(new Error('Could not read a token from the GitHub CLI. Run `gh auth login` first.'))
      else resolve(token)
    })
  })
}

const toPr = (p: GhPull): PullRequestInfo => ({
  number: p.number,
  title: p.title,
  url: p.html_url,
  state: p.merged_at ? 'merged' : p.state
})

// Caches live for the app session; commits and PR titles rarely change.
const commitPrCache = new Map<string, PullRequestInfo | null>()
const prCache = new Map<string, PullRequestInfo | null>()

async function prForCommit(token: string, repo: string, sha: string): Promise<PullRequestInfo | null> {
  const key = `${repo}@${sha}`
  if (commitPrCache.has(key)) return commitPrCache.get(key)!
  const pulls = await gh<GhPull[]>(token, `/repos/${repo}/commits/${sha}/pulls`)
  const pr = pulls && pulls.length > 0 ? toPr(pulls[0]) : null
  commitPrCache.set(key, pr)
  return pr
}

async function prDetails(token: string, repo: string, n: number): Promise<PullRequestInfo | null> {
  const key = `${repo}#${n}`
  if (prCache.has(key)) return prCache.get(key)!
  const pull = await gh<GhPull>(token, `/repos/${repo}/pulls/${n}`)
  const pr = pull ? toPr(pull) : null
  prCache.set(key, pr)
  return pr
}

async function pool<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  })
  await Promise.all(workers)
}

/**
 * Fills in PR numbers, titles and states from GitHub. Mutates the given deployments.
 * Deployments on non-GitHub repos are left untouched.
 */
export async function enrichWithGithub(token: string, deployments: Deployment[]): Promise<void> {
  const targets = deployments.filter((d) => d.commit?.repo && d.commit.url?.startsWith('https://github.com/'))
  let rateLimited = false

  await pool(targets, async (d) => {
    if (rateLimited) return
    const repo = d.commit!.repo!
    try {
      const pr = d.pr ? await prDetails(token, repo, d.pr.number) : await prForCommit(token, repo, d.commit!.sha)
      if (pr) d.pr = { ...d.pr, ...pr }
    } catch (err) {
      if (String(err).includes('403') || String(err).includes('429')) rateLimited = true
    }
  })
}
