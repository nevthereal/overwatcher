import type { Deployment, DeploymentState } from '../../shared/types'

const API = 'https://backboard.railway.com/graphql/v2'
const PER_PROJECT = 20
const PROJECTS_PER_QUERY = 8

interface RailwayProject {
  id: string
  name: string
  workspace?: { name?: string } | null
}

interface RailwayDeploymentNode {
  id: string
  status: string
  createdAt: string
  updatedAt?: string
  url?: string | null
  staticUrl?: string | null
  meta?: Record<string, unknown> | null
  creator?: { name?: string | null } | null
  service?: { id: string; name: string } | null
  environment?: {
    id: string
    name: string
    meta?: { prNumber?: number | null; prRepo?: string | null; prTitle?: string | null } | null
  } | null
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  const body = (await res.json().catch(() => ({}))) as {
    data?: T
    errors?: { message: string }[]
  }
  if (!res.ok || body.errors?.length) {
    const msg = body.errors?.map((e) => e.message).join('; ') || res.statusText
    throw new Error(`Railway API ${res.status}: ${msg}`)
  }
  return body.data as T
}

/** Returns a display name for the token's owner. Works with account and workspace tokens. */
export async function verifyRailway(token: string): Promise<string> {
  try {
    const { me } = await gql<{ me: { name?: string; username?: string; email?: string } }>(
      token,
      'query { me { name username email } }'
    )
    return me.username ?? me.name ?? me.email ?? 'Railway account'
  } catch (err) {
    // Workspace tokens can't query `me`, but can list projects.
    const { projects } = await gql<{ projects: { edges: { node: RailwayProject }[] } }>(
      token,
      'query { projects(first: 1) { edges { node { id name workspace { name } } } } }'
    ).catch(() => {
      throw err
    })
    return projects.edges[0]?.node.workspace?.name ?? 'Railway workspace'
  }
}

async function listProjects(token: string): Promise<RailwayProject[]> {
  try {
    const { me } = await gql<{
      me: { workspaces: { name: string; projects: { edges: { node: RailwayProject }[] } }[] }
    }>(
      token,
      `query { me { workspaces { name projects(first: 100) { edges { node { id name } } } } } }`
    )
    return me.workspaces.flatMap((w) =>
      w.projects.edges.map((e) => ({ ...e.node, workspace: { name: w.name } }))
    )
  } catch {
    const { projects } = await gql<{ projects: { edges: { node: RailwayProject }[] } }>(
      token,
      'query { projects(first: 100) { edges { node { id name workspace { name } } } } }'
    )
    return projects.edges.map((e) => e.node)
  }
}

const DEPLOYMENT_FIELDS = `
  edges { node {
    id status createdAt updatedAt url staticUrl meta
    creator { name }
    service { id name }
    environment { id name meta { prNumber prRepo prTitle } }
  } }
`

function mapState(status: string): DeploymentState {
  switch (status) {
    case 'QUEUED':
    case 'WAITING':
    case 'INITIALIZING':
    case 'NEEDS_APPROVAL':
      return 'queued'
    case 'BUILDING':
    case 'DEPLOYING':
      return 'building'
    case 'SUCCESS':
      return 'ready'
    case 'FAILED':
    case 'CRASHED':
      return 'error'
    case 'SKIPPED':
      return 'canceled'
    case 'SLEEPING':
      return 'sleeping'
    case 'REMOVED':
    case 'REMOVING':
      return 'removed'
    default:
      return 'unknown'
  }
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)

function toDeployment(node: RailwayDeploymentNode, project: RailwayProject): Deployment {
  const meta = node.meta ?? {}
  const envMeta = node.environment?.meta
  const sha = str(meta.commitHash)
  const repo = str(meta.repo) ?? envMeta?.prRepo ?? undefined
  const envName = node.environment?.name ?? 'unknown'
  const rawUrl = node.staticUrl ?? node.url ?? undefined
  const prNumber = envMeta?.prNumber ?? undefined

  return {
    key: `railway:${node.id}`,
    provider: 'railway',
    id: node.id,
    scope: project.workspace?.name ?? 'Railway',
    project: project.name,
    service: node.service?.name,
    environment: envName,
    isProduction: envName.toLowerCase() === 'production',
    state: mapState(node.status),
    rawStatus: node.status,
    createdAt: Date.parse(node.createdAt),
    updatedAt: node.updatedAt ? Date.parse(node.updatedAt) : undefined,
    url: rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`) : undefined,
    dashboardUrl:
      node.service && node.environment
        ? `https://railway.com/project/${project.id}/service/${node.service.id}?environmentId=${node.environment.id}&id=${node.id}`
        : `https://railway.com/project/${project.id}`,
    creator: node.creator?.name ?? undefined,
    commit: sha
      ? {
          sha,
          message: str(meta.commitMessage),
          branch: str(meta.branch) ?? undefined,
          author: str(meta.commitAuthor),
          repo,
          url: repo ? `https://github.com/${repo}/commit/${sha}` : undefined
        }
      : undefined,
    pr: prNumber
      ? {
          number: prNumber,
          title: envMeta?.prTitle ?? undefined,
          url: repo ? `https://github.com/${repo}/pull/${prNumber}` : undefined
        }
      : undefined
  }
}

export async function fetchRailwayDeployments(token: string): Promise<Deployment[]> {
  const projects = await listProjects(token)
  const out: Deployment[] = []

  for (let i = 0; i < projects.length; i += PROJECTS_PER_QUERY) {
    const chunk = projects.slice(i, i + PROJECTS_PER_QUERY)
    const query = `query {${chunk
      .map(
        (p, j) =>
          `p${j}: deployments(first: ${PER_PROJECT}, input: { projectId: ${JSON.stringify(p.id)} }) { ${DEPLOYMENT_FIELDS} }`
      )
      .join('\n')}}`
    const data = await gql<Record<string, { edges: { node: RailwayDeploymentNode }[] }>>(token, query)
    chunk.forEach((p, j) => {
      for (const { node } of data[`p${j}`]?.edges ?? []) out.push(toDeployment(node, p))
    })
  }
  return out
}
