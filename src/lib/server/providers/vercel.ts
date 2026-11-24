import type { Deployment, DeploymentState } from '#lib/types.js'

const API = 'https://api.vercel.com'
const PER_SCOPE = 40

interface VercelTeam {
  id: string
  slug: string
  name?: string
}

interface VercelDeployment {
  uid: string
  name: string
  url?: string
  created: number
  ready?: number
  state?: string
  readyState?: string
  target?: string | null
  inspectorUrl?: string
  creator?: { username?: string; githubLogin?: string }
  meta?: Record<string, string | undefined>
}

async function vercel<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, API)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      detail = body.error?.message ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(`Vercel API ${res.status}: ${detail}`)
  }
  return (await res.json()) as T
}

export async function verifyVercel(token: string): Promise<string> {
  const { user } = await vercel<{ user: { username?: string; name?: string; email?: string } }>(
    token,
    '/v2/user'
  )
  return user.username ?? user.name ?? user.email ?? 'Vercel account'
}

function mapState(state?: string): DeploymentState {
  switch (state) {
    case 'QUEUED':
    case 'INITIALIZING':
      return 'queued'
    case 'BUILDING':
      return 'building'
    case 'READY':
      return 'ready'
    case 'ERROR':
      return 'error'
    case 'CANCELED':
      return 'canceled'
    case 'DELETED':
      return 'removed'
    default:
      return 'unknown'
  }
}

function toDeployment(d: VercelDeployment, scope: string): Deployment {
  const m = d.meta ?? {}
  const sha = m.githubCommitSha ?? m.gitlabCommitSha ?? m.bitbucketCommitSha
  const org = m.githubCommitOrg ?? m.githubOrg
  const repoName = m.githubCommitRepo ?? m.githubRepo
  const repo = org && repoName ? `${org}/${repoName}` : (m.gitlabProjectPath ?? undefined)
  const prNumber = Number(m.githubPrId ?? m.gitlabMergeRequestIid ?? m.bitbucketPrId)
  const rawStatus = d.readyState ?? d.state ?? 'UNKNOWN'

  return {
    key: `vercel:${d.uid}`,
    provider: 'vercel',
    id: d.uid,
    scope,
    project: d.name,
    environment: d.target === 'production' ? 'Production' : d.target ? capitalize(d.target) : 'Preview',
    isProduction: d.target === 'production',
    state: mapState(rawStatus),
    rawStatus,
    createdAt: d.created,
    updatedAt: d.ready,
    url: d.url ? `https://${d.url}` : undefined,
    dashboardUrl: d.inspectorUrl,
    creator: d.creator?.githubLogin ?? d.creator?.username,
    commit: sha
      ? {
          sha,
          message: m.githubCommitMessage ?? m.gitlabCommitMessage ?? m.bitbucketCommitMessage,
          branch: m.githubCommitRef ?? m.gitlabCommitRef ?? m.bitbucketCommitRef,
          author:
            m.githubCommitAuthorLogin ??
            m.githubCommitAuthorName ??
            m.gitlabCommitAuthorName ??
            m.bitbucketCommitAuthorName,
          authorAvatar: m.githubCommitAuthorLogin
            ? `https://github.com/${m.githubCommitAuthorLogin}.png?size=48`
            : undefined,
          repo,
          url: m.githubCommitSha && repo ? `https://github.com/${repo}/commit/${sha}` : undefined
        }
      : undefined,
    pr:
      Number.isFinite(prNumber) && prNumber > 0
        ? {
            number: prNumber,
            url: m.githubPrId && repo ? `https://github.com/${repo}/pull/${prNumber}` : undefined
          }
        : undefined
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * Deployments from the personal scope and every team. A team that fails doesn't hide the others:
 * its error comes back in `warnings`, so the feed can say what's missing.
 */
export async function fetchVercelDeployments(token: string): Promise<{ deployments: Deployment[]; warnings: string[] }> {
  const warnings: string[] = []
  const [{ teams }, accountName] = await Promise.all([
    vercel<{ teams: VercelTeam[] }>(token, '/v2/teams', { limit: '100' }).catch((err) => {
      warnings.push(`Could not list teams, showing personal deployments only. ${message(err)}`)
      return { teams: [] as VercelTeam[] }
    }),
    verifyVercel(token)
  ])

  const scopes: { teamId?: string; label: string }[] = [
    { label: accountName },
    ...teams.map((t) => ({ teamId: t.id, label: t.name ?? t.slug }))
  ]

  const results = await Promise.allSettled(
    scopes.map(async ({ teamId, label }) => {
      const params: Record<string, string> = { limit: String(PER_SCOPE) }
      if (teamId) params.teamId = teamId
      const { deployments } = await vercel<{ deployments: VercelDeployment[] }>(
        token,
        '/v6/deployments',
        params
      )
      return deployments.map((d) => toDeployment(d, label))
    })
  )

  const seen = new Map<string, Deployment>()
  const failures: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failures.push(`${scopes[i].label}: ${message(r.reason)}`)
      return
    }
    // Team-scoped results win over the unscoped call, since they carry the right label.
    for (const d of r.value) seen.set(d.key, d)
  })
  if (seen.size === 0 && failures.length > 0) throw new Error(failures.join('; '))
  if (failures.length > 0) warnings.push(`Some scopes could not be loaded. ${failures.join('; ')}`)
  return { deployments: [...seen.values()], warnings }
}
