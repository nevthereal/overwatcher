import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionStatus, Deployment, FetchResult } from '../../shared/types'
import { dayLabel, firstLine, isActive, STATE_LABEL, timeAgo } from './format'
import { AccountsDialog } from './Accounts'
import { DeploymentRow } from './DeploymentRow'

const api = window.overwatcher

type ProviderFilter = 'all' | 'vercel' | 'railway'
type EnvFilter = 'all' | 'production' | 'preview'
type StatusFilter = 'all' | 'active' | 'failed'

interface Filters {
  provider: ProviderFilter
  env: EnvFilter
  status: StatusFilter
  project: string | null
  latestOnly: boolean
}

const DEFAULT_FILTERS: Filters = { provider: 'all', env: 'all', status: 'all', project: null, latestOnly: false }
const FILTERS_KEY = 'overwatcher.filters'
const IDLE_REFRESH_MS = 60_000
const ACTIVE_REFRESH_MS = 10_000

function loadFilters(): Filters {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_FILTERS
  }
}

const projectKey = (d: Deployment) => `${d.provider}:${d.scope}:${d.project}`

export function App() {
  const [connections, setConnections] = useState<ConnectionStatus[]>([])
  const [result, setResult] = useState<FetchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [search, setSearch] = useState('')
  const [showAccounts, setShowAccounts] = useState(false)
  const [, setTick] = useState(0)
  const previousStates = useRef(new Map<string, Deployment['state']>())
  const inFlight = useRef(false)

  const deployConnected = connections.some((c) => c.connected && c.provider !== 'github')

  const refreshConnections = useCallback(async () => setConnections(await api.getConnections()), [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      const next = await api.fetchDeployments()
      notifyTransitions(previousStates.current, next.deployments)
      setResult(next)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshConnections()
  }, [refreshConnections])

  useEffect(() => {
    if (deployConnected) void refresh()
    else setResult(null)
  }, [deployConnected, connections, refresh])

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch {
      /* storage unavailable */
    }
  }, [filters])

  const anyActive = result?.deployments.some((d) => isActive(d.state)) ?? false

  // Poll faster while something is building; refresh on focus.
  useEffect(() => {
    if (!deployConnected) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' || anyActive) void refresh()
    }, anyActive ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [deployConnected, anyActive, refresh])

  // Keep relative timestamps fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const all = result?.deployments ?? []

  const projects = useMemo(() => {
    const map = new Map<string, { key: string; name: string; provider: Deployment['provider']; scope: string; latest: Deployment; count: number }>()
    for (const d of all) {
      if (filters.provider !== 'all' && d.provider !== filters.provider) continue
      const key = projectKey(d)
      const entry = map.get(key)
      if (entry) entry.count++
      else map.set(key, { key, name: d.project, provider: d.provider, scope: d.scope, latest: d, count: 1 })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [all, filters.provider])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = all.filter((d) => {
      if (filters.provider !== 'all' && d.provider !== filters.provider) return false
      if (filters.env === 'production' && !d.isProduction) return false
      if (filters.env === 'preview' && d.isProduction) return false
      if (filters.status === 'active' && !isActive(d.state)) return false
      if (filters.status === 'failed' && d.state !== 'error') return false
      if (filters.project && projectKey(d) !== filters.project) return false
      if (q) {
        const hay = [
          d.project,
          d.service,
          d.environment,
          d.commit?.message,
          d.commit?.branch,
          d.commit?.sha,
          d.commit?.author,
          d.pr?.title,
          d.pr ? `#${d.pr.number}` : undefined
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (filters.latestOnly) {
      const seen = new Set<string>()
      list = list.filter((d) => {
        const k = `${projectKey(d)}:${d.service ?? ''}:${d.environment}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }
    return list
  }, [all, filters, search])

  const groups = useMemo(() => {
    const out: { label: string; items: Deployment[] }[] = []
    for (const d of visible) {
      const label = dayLabel(d.createdAt)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(d)
      else out.push({ label, items: [d] })
    }
    return out
  }, [visible])

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'provider' ? { project: null } : {}) }))

  const counts = {
    active: all.filter((d) => isActive(d.state)).length,
    failed: all.filter((d) => d.state === 'error').length
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="drag sidebar-top" />
        <div className="brand">
          <span className="brand-mark">O</span>
          Overwatcher
        </div>

        <nav className="nav">
          <Section title="Status">
            <NavItem active={filters.status === 'all'} onClick={() => setFilter('status', 'all')} label="All deployments" count={all.length} />
            <NavItem active={filters.status === 'active'} onClick={() => setFilter('status', 'active')} label="In progress" count={counts.active} dot="building" />
            <NavItem active={filters.status === 'failed'} onClick={() => setFilter('status', 'failed')} label="Failed" count={counts.failed} dot="error" />
          </Section>

          <Section title="Platform">
            <Segmented
              value={filters.provider}
              options={[['all', 'All'], ['vercel', 'Vercel'], ['railway', 'Railway']]}
              onChange={(v) => setFilter('provider', v)}
            />
          </Section>

          <Section title="Environment">
            <Segmented
              value={filters.env}
              options={[['all', 'All'], ['production', 'Prod'], ['preview', 'Preview']]}
              onChange={(v) => setFilter('env', v)}
            />
          </Section>

          <Section title="Projects">
            <NavItem active={filters.project === null} onClick={() => setFilter('project', null)} label="All projects" count={projects.length} />
            {projects.map((p) => (
              <NavItem
                key={p.key}
                active={filters.project === p.key}
                onClick={() => setFilter('project', p.key)}
                label={p.name}
                hint={p.provider === 'vercel' ? 'Vercel' : 'Railway'}
                dot={p.latest.state}
                title={`${p.scope} · latest ${STATE_LABEL[p.latest.state].toLowerCase()} ${timeAgo(p.latest.createdAt)}`}
              />
            ))}
          </Section>
        </nav>

        <button className="accounts-btn" onClick={() => setShowAccounts(true)}>
          <span className="acct-dots">
            {connections.map((c) => (
              <span key={c.provider} className={`acct-dot ${c.connected ? 'on' : ''}`} title={`${c.provider}${c.account ? `: ${c.account}` : ''}`} />
            ))}
          </span>
          Accounts
        </button>
      </aside>

      <main className="main">
        <header className="toolbar drag">
          <div className="search no-drag">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search commits, branches, PRs, projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="toggle no-drag" title="Only show the newest deployment per project, service and environment">
            <input type="checkbox" checked={filters.latestOnly} onChange={(e) => setFilter('latestOnly', e.target.checked)} />
            Latest only
          </label>
          <div className="spacer" />
          {result && <span className="muted small">Updated {timeAgo(result.fetchedAt)}</span>}
          <button className="icon-btn no-drag" onClick={() => void refresh()} disabled={loading || !deployConnected} title="Refresh (⌘R)">
            <svg viewBox="0 0 16 16" width="14" height="14" className={loading ? 'spin' : ''} aria-hidden>
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

        {result?.errors.map((e) => (
          <div key={e.provider} className="banner">
            <strong>{e.provider}</strong> {e.message}
          </div>
        ))}

        <div className="feed">
          {!deployConnected && connections.length > 0 ? (
            <Onboarding onOpen={() => setShowAccounts(true)} />
          ) : !result ? (
            <div className="empty">Loading deployments…</div>
          ) : visible.length === 0 ? (
            <div className="empty">No deployments match these filters.</div>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="group">
                <h3 className="group-label">{g.label}</h3>
                <div className="rows">
                  {g.items.map((d) => (
                    <DeploymentRow key={d.key} d={d} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {showAccounts && (
        <AccountsDialog
          connections={connections}
          onClose={() => setShowAccounts(false)}
          onChanged={refreshConnections}
        />
      )}
    </div>
  )
}

function Onboarding({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="onboarding">
      <h2>Connect your deployment platforms</h2>
      <p className="muted">
        Add a Vercel or Railway access token to see your latest deployments, with the commit and pull request behind
        each one. Tokens stay on this machine, encrypted with your system keychain.
      </p>
      <button className="primary" onClick={onOpen}>
        Connect accounts
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      {children}
    </div>
  )
}

function NavItem(props: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  hint?: string
  dot?: Deployment['state']
  title?: string
}) {
  return (
    <button className={`nav-item ${props.active ? 'active' : ''}`} onClick={props.onClick} title={props.title}>
      {props.dot && <span className={`dot ${props.dot}`} />}
      <span className="nav-label">{props.label}</span>
      {props.hint && <span className="nav-hint">{props.hint}</span>}
      {props.count !== undefined && <span className="nav-count">{props.count}</span>}
    </button>
  )
}

function Segmented<T extends string>(props: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {props.options.map(([v, label]) => (
        <button key={v} className={props.value === v ? 'on' : ''} onClick={() => props.onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Fires a system notification when a deployment we saw in progress finishes. */
function notifyTransitions(prev: Map<string, Deployment['state']>, next: Deployment[]) {
  const firstRun = prev.size === 0
  for (const d of next) {
    const before = prev.get(d.key)
    prev.set(d.key, d.state)
    if (firstRun || !before || !isActive(before) || isActive(d.state)) continue
    if (d.state !== 'ready' && d.state !== 'error') continue
    const name = d.service ? `${d.project} / ${d.service}` : d.project
    const n = new Notification(`${d.state === 'ready' ? '✅' : '❌'} ${name} ${d.state === 'ready' ? 'deployed' : 'failed'}`, {
      body: [d.environment, d.commit?.branch, firstLine(d.commit?.message)].filter(Boolean).join(' · '),
      silent: d.state === 'ready'
    })
    const target = d.dashboardUrl ?? d.url
    if (target) n.onclick = () => void api.openExternal(target)
  }
}
