import type { ConnectionStatus, Deployment, FetchResult } from '../shared/types'

/** Fake data for working on the UI without real tokens: `OVERWATCHER_DEMO=1 bun run dev`. */
export const DEMO = process.env.OVERWATCHER_DEMO === '1'

export const demoConnections: ConnectionStatus[] = [
  { provider: 'vercel', connected: true, account: 'acme' },
  { provider: 'railway', connected: true, account: 'acme' },
  { provider: 'github', connected: true, account: 'acme-bot' }
]

const min = 60_000

export function demoDeployments(): FetchResult {
  const now = Date.now()
  const gh = (repo: string, sha: string) => `https://github.com/${repo}/commit/${sha}`
  const d: Deployment[] = [
    {
      key: 'vercel:1', provider: 'vercel', id: '1', scope: 'Acme', project: 'marketing-site',
      environment: 'Preview', isProduction: false, state: 'building', rawStatus: 'BUILDING',
      createdAt: now - 1 * min, url: 'https://marketing-site-git-pricing-acme.vercel.app',
      dashboardUrl: 'https://vercel.com',
      commit: { sha: '9f2c1ab4e7d', message: 'Rework pricing table for annual plans', branch: 'feat/annual-pricing', author: 'jdoe', repo: 'acme/marketing-site', url: gh('acme/marketing-site', '9f2c1ab4e7d') },
      pr: { number: 412, title: 'Annual pricing toggle', url: 'https://github.com/acme/marketing-site/pull/412', state: 'open' }
    },
    {
      key: 'railway:2', provider: 'railway', id: '2', scope: 'Acme', project: 'core', service: 'api',
      environment: 'production', isProduction: true, state: 'ready', rawStatus: 'SUCCESS',
      createdAt: now - 18 * min, updatedAt: now - 15 * min, url: 'https://api.acme.dev', dashboardUrl: 'https://railway.com',
      commit: { sha: '3b7e0d91c2a', message: 'Add rate limiting to /v1/events\n\nUses a sliding window per API key.', branch: 'main', author: 'sam', repo: 'acme/core', url: gh('acme/core', '3b7e0d91c2a') },
      pr: { number: 1288, title: 'Rate limit events endpoint', url: 'https://github.com/acme/core/pull/1288', state: 'merged' }
    },
    {
      key: 'railway:3', provider: 'railway', id: '3', scope: 'Acme', project: 'core', service: 'worker',
      environment: 'production', isProduction: true, state: 'error', rawStatus: 'FAILED',
      createdAt: now - 19 * min, updatedAt: now - 17 * min, dashboardUrl: 'https://railway.com',
      commit: { sha: '3b7e0d91c2a', message: 'Add rate limiting to /v1/events', branch: 'main', author: 'sam', repo: 'acme/core', url: gh('acme/core', '3b7e0d91c2a') },
      pr: { number: 1288, title: 'Rate limit events endpoint', url: 'https://github.com/acme/core/pull/1288', state: 'merged' }
    },
    {
      key: 'vercel:4', provider: 'vercel', id: '4', scope: 'Acme', project: 'dashboard',
      environment: 'Production', isProduction: true, state: 'ready', rawStatus: 'READY',
      createdAt: now - 2 * 60 * min, updatedAt: now - 2 * 60 * min + 94_000, url: 'https://app.acme.dev', dashboardUrl: 'https://vercel.com',
      commit: { sha: 'c0ffee12345', message: 'Fix chart tooltips overflowing on small screens', branch: 'main', author: 'jdoe', authorAvatar: undefined, repo: 'acme/dashboard', url: gh('acme/dashboard', 'c0ffee12345') },
      pr: { number: 87, title: 'Tooltip overflow fix', url: 'https://github.com/acme/dashboard/pull/87', state: 'merged' }
    },
    {
      key: 'railway:5', provider: 'railway', id: '5', scope: 'Acme', project: 'core', service: 'api',
      environment: 'core-pr-1291', isProduction: false, state: 'sleeping', rawStatus: 'SLEEPING',
      createdAt: now - 26 * 60 * min, url: 'https://api-core-pr-1291.up.railway.app', dashboardUrl: 'https://railway.com',
      commit: { sha: 'aa41d07be93', message: 'Experiment: switch to pgbouncer transaction mode', branch: 'exp/pgbouncer', author: 'lee', repo: 'acme/core', url: gh('acme/core', 'aa41d07be93') },
      pr: { number: 1291, title: 'pgbouncer transaction pooling', url: 'https://github.com/acme/core/pull/1291', state: 'open' }
    },
    {
      key: 'vercel:6', provider: 'vercel', id: '6', scope: 'Acme', project: 'docs',
      environment: 'Production', isProduction: true, state: 'ready', rawStatus: 'READY',
      createdAt: now - 28 * 60 * min, updatedAt: now - 28 * 60 * min + 41_000, url: 'https://docs.acme.dev', dashboardUrl: 'https://vercel.com',
      creator: 'jdoe'
    },
    {
      key: 'railway:7', provider: 'railway', id: '7', scope: 'Acme', project: 'core', service: 'api',
      environment: 'production', isProduction: true, state: 'removed', rawStatus: 'REMOVED',
      createdAt: now - 30 * 60 * min, dashboardUrl: 'https://railway.com',
      commit: { sha: '5d1e8f0a2b3', message: 'Bump dependencies', branch: 'main', author: 'renovate[bot]', repo: 'acme/core', url: gh('acme/core', '5d1e8f0a2b3') }
    }
  ]
  return { deployments: d, errors: [], fetchedAt: now }
}
