export type ProviderId = 'vercel' | 'railway' | 'github'

/** Normalized deployment state across providers. */
export type DeploymentState =
  | 'queued'
  | 'building'
  | 'ready'
  | 'error'
  | 'canceled'
  | 'sleeping'
  | 'removed'
  | 'unknown'

export interface CommitInfo {
  sha: string
  message?: string
  branch?: string
  author?: string
  authorAvatar?: string
  /** "owner/repo" */
  repo?: string
  url?: string
}

export interface PullRequestInfo {
  number: number
  title?: string
  url?: string
  state?: 'open' | 'closed' | 'merged'
}

export interface Deployment {
  /** Globally unique key: `${provider}:${id}` */
  key: string
  provider: 'vercel' | 'railway'
  id: string
  /** Account/team/workspace the deployment belongs to. */
  scope: string
  project: string
  /** Railway service name; undefined for Vercel. */
  service?: string
  environment: string
  isProduction: boolean
  state: DeploymentState
  rawStatus: string
  createdAt: number
  updatedAt?: number
  /** Live URL of the deployment, if any. */
  url?: string
  /** Provider dashboard URL for this deployment. */
  dashboardUrl?: string
  commit?: CommitInfo
  pr?: PullRequestInfo
  creator?: string
}

export interface ConnectionStatus {
  provider: ProviderId
  connected: boolean
  /** Display name of the account the token belongs to. */
  account?: string
}

export interface ProviderError {
  provider: ProviderId
  message: string
}

export interface FetchResult {
  deployments: Deployment[]
  errors: ProviderError[]
  fetchedAt: number
}

export const isActive = (s: DeploymentState) => s === 'queued' || s === 'building'

/** One row in the macOS menu bar menu. Mirrored in electron/menu-bar.ts. */
export interface MenuBarItem {
  key: string
  provider: 'vercel' | 'railway'
  /** "project" or "project / service" */
  name: string
  environment: string
  isProduction: boolean
  state: DeploymentState
  createdAt: number
  message?: string
  branch?: string
  sha?: string
  commitUrl?: string
  pr?: PullRequestInfo
  url?: string
  dashboardUrl?: string
}

export interface MenuBarSummary {
  connected: boolean
  fetchedAt: number
  errors: ProviderError[]
  /** Newest deployment per project, service and environment, newest first. */
  targets: MenuBarItem[]
}
