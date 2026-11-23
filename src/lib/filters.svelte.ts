import { createContext } from 'svelte'
import { dayLabel } from '#lib/format.js'
import { isActive, type Deployment } from '#lib/types.js'

export type ProviderFilter = 'all' | 'vercel' | 'railway'
export type EnvFilter = 'all' | 'production' | 'preview'
export type StatusFilter = 'all' | 'active' | 'failed'

const STORAGE_KEY = 'overwatcher.filters'

export const projectKey = (d: Deployment) => `${d.provider}:${d.scope}:${d.project}`

export class Filters {
	provider = $state<ProviderFilter>('all')
	env = $state<EnvFilter>('all')
	status = $state<StatusFilter>('all')
	project = $state<string | null>(null)
	latestOnly = $state(false)
	search = $state('')

	constructor() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
			for (const key of ['provider', 'env', 'status', 'project', 'latestOnly'] as const) {
				if (key in saved) (this as Record<string, unknown>)[key] = saved[key]
			}
		} catch {
			/* storage unavailable or corrupt: keep defaults */
		}
	}

	save() {
		const { provider, env, status, project, latestOnly } = this
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, env, status, project, latestOnly }))
		} catch {
			/* storage unavailable */
		}
	}

	setProvider(value: ProviderFilter) {
		this.provider = value
		this.project = null
	}

	matches(d: Deployment, ignoreStatus = false): boolean {
		if (this.provider !== 'all' && d.provider !== this.provider) return false
		if (this.env === 'production' && !d.isProduction) return false
		if (this.env === 'preview' && d.isProduction) return false
		if (!ignoreStatus && this.status === 'active' && !isActive(d.state)) return false
		if (!ignoreStatus && this.status === 'failed' && d.state !== 'error') return false
		if (this.project && projectKey(d) !== this.project) return false
		const q = this.search.trim().toLowerCase()
		if (q) {
			const haystack = [
				d.project,
				d.service,
				d.environment,
				d.commit?.message,
				d.commit?.branch,
				d.commit?.sha,
				d.commit?.author,
				d.commit?.repo,
				d.pr?.title,
				d.pr && `#${d.pr.number}`
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
			if (!haystack.includes(q)) return false
		}
		return true
	}

	apply(deployments: Deployment[]): Deployment[] {
		const list = deployments.filter((d) => this.matches(d))
		if (!this.latestOnly) return list
		const seen = new Set<string>()
		return list.filter((d) => {
			const key = `${projectKey(d)}:${d.service ?? ''}:${d.environment}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	}
}

export const [getFilters, setFilters] = createContext<Filters>()

export function groupByDay(deployments: Deployment[]) {
	const groups: { label: string; items: Deployment[] }[] = []
	for (const d of deployments) {
		const label = dayLabel(d.createdAt)
		const last = groups.at(-1)
		if (last?.label === label) last.items.push(d)
		else groups.push({ label, items: [d] })
	}
	return groups
}
