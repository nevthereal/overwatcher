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
  /** Last four characters of the token. */
  tokenHint?: string
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

/** The Railway service name, unless it just repeats the project name. */
export const serviceLabel = (d: Pick<Deployment, 'project' | 'service'>) =>
  d.service && d.service.toLowerCase() !== d.project.toLowerCase() ? d.service : undefined
