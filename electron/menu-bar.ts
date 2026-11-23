import { app, clipboard, Menu, nativeImage, Notification, shell, Tray, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import { join } from 'node:path'

// Mirrors MenuBarItem / MenuBarSummary in src/lib/types.ts.
type DeploymentState = 'queued' | 'building' | 'ready' | 'error' | 'canceled' | 'sleeping' | 'removed' | 'unknown'

interface MenuBarItem {
	key: string
	provider: 'vercel' | 'railway'
	name: string
	environment: string
	isProduction: boolean
	state: DeploymentState
	createdAt: number
	message?: string
	branch?: string
	sha?: string
	commitUrl?: string
	pr?: { number: number; title?: string; url?: string; state?: 'open' | 'closed' | 'merged' }
	url?: string
	dashboardUrl?: string
}

interface MenuBarSummary {
	connected: boolean
	fetchedAt: number
	errors: { provider: string; message: string }[]
	targets: MenuBarItem[]
}

export interface MenuBarOptions {
	/** Root URL of the local SvelteKit server, with trailing slash. */
	serverUrl: string
	/** Cookie header that authenticates requests to the local server. */
	cookie: string
	resourcesDir: string
	/** Opens (or focuses) the main window at a path such as "/" or "/accounts". */
	openWindow: (path?: string) => void
	quit: () => void
}

const ACTIVE_POLL_MS = 10_000
const IDLE_POLL_MS = 60_000
const MENU_REBUILD_MS = 30_000
const MAX_PER_SECTION = 8
const MAX_PREVIEWS = 5

const isActive = (s: DeploymentState) => s === 'queued' || s === 'building'

const STATE_LABEL: Record<DeploymentState, string> = {
	queued: 'Queued',
	building: 'Building',
	ready: 'Ready',
	error: 'Failed',
	canceled: 'Canceled',
	sleeping: 'Sleeping',
	removed: 'Removed',
	unknown: 'Unknown'
}

function timeAgo(ts: number): string {
	const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
	if (s < 45) return 'just now'
	const m = Math.round(s / 60)
	if (m < 60) return `${m}m ago`
	const h = Math.round(m / 60)
	if (h < 24) return `${h}h ago`
	return `${Math.round(h / 24)}d ago`
}

/** A small filled (or hollow, for queued) status dot to use as a menu item icon. */
function dot([r, g, b]: [number, number, number], hollow = false): NativeImage {
	const size = 24 // 12pt at 2x
	const center = (size - 1) / 2
	const radius = 7
	const buffer = Buffer.alloc(size * size * 4)
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const d = Math.hypot(x - center, y - center)
			let alpha = Math.max(0, Math.min(1, radius + 0.5 - d))
			if (hollow) alpha = Math.min(alpha, Math.max(0, Math.min(1, d - (radius - 2.5) + 0.5)))
			const i = (y * size + x) * 4
			// BGRA, premultiplied
			buffer[i] = Math.round(b * alpha)
			buffer[i + 1] = Math.round(g * alpha)
			buffer[i + 2] = Math.round(r * alpha)
			buffer[i + 3] = Math.round(255 * alpha)
		}
	}
	return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: 2 })
}

const DOTS: Record<DeploymentState, NativeImage> = {
	ready: dot([34, 197, 94]),
	error: dot([239, 68, 68]),
	building: dot([245, 158, 11]),
	queued: dot([245, 158, 11], true),
	sleeping: dot([139, 92, 246]),
	canceled: dot([156, 163, 175]),
	removed: dot([156, 163, 175]),
	unknown: dot([156, 163, 175])
}

export class MenuBar {
	private tray: Tray
	private summary: MenuBarSummary | undefined
	private lastError: string | undefined
	private pollTimer: NodeJS.Timeout | undefined
	private seenStates = new Map<string, DeploymentState>()

	constructor(private options: MenuBarOptions) {
		const icon = nativeImage.createFromPath(join(options.resourcesDir, 'tray/trayTemplate.png'))
		icon.setTemplateImage(true)
		this.tray = new Tray(icon)
		this.tray.setToolTip('Overwatcher')
		this.render()
		void this.poll()
		// Keep relative times ("5m ago") fresh between polls.
		setInterval(() => this.render(), MENU_REBUILD_MS).unref()
	}

	/** Fetches now, bypassing the shared cache. */
	refresh(): Promise<void> {
		return this.poll(0)
	}

	private async poll(maxAge = 8_000): Promise<void> {
		clearTimeout(this.pollTimer)
		try {
			const res = await fetch(`${this.options.serverUrl}api/menu-bar?maxAge=${maxAge}`, {
				headers: { cookie: this.options.cookie }
			})
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
			const summary = (await res.json()) as MenuBarSummary
			this.notifyTransitions(summary.targets)
			this.summary = summary
			this.lastError = undefined
		} catch (err) {
			this.lastError = err instanceof Error ? err.message : String(err)
		}
		this.render()
		const busy = this.summary?.targets.some((t) => isActive(t.state))
		this.pollTimer = setTimeout(() => void this.poll(), busy ? ACTIVE_POLL_MS : IDLE_POLL_MS)
	}

	/** System notification when a deployment that was in progress finishes. */
	private notifyTransitions(targets: MenuBarItem[]): void {
		const firstRun = this.seenStates.size === 0
		for (const t of targets) {
			const before = this.seenStates.get(t.key)
			this.seenStates.set(t.key, t.state)
			if (firstRun || !before || !isActive(before) || isActive(t.state)) continue
			if (t.state !== 'ready' && t.state !== 'error') continue
			const notification = new Notification({
				title: `${t.name} ${t.state === 'ready' ? 'deployed' : 'failed'}`,
				body: [t.environment, t.branch, t.message].filter(Boolean).join(' · '),
				silent: t.state === 'ready'
			})
			const target = t.dashboardUrl ?? t.url
			if (target) notification.on('click', () => void shell.openExternal(target))
			notification.show()
		}
	}

	private render(): void {
		const targets = this.summary?.targets ?? []
		const building = targets.filter((t) => isActive(t.state))
		const failing = targets.filter((t) => t.state === 'error')

		const title = [building.length && `↻ ${building.length}`, failing.length && `✕ ${failing.length}`]
			.filter(Boolean)
			.join('  ')
		this.tray.setTitle(title ? ` ${title}` : '', { fontType: 'monospacedDigit' })
		this.tray.setToolTip(
			['Overwatcher', building.length && `${building.length} in progress`, failing.length && `${failing.length} failing`]
				.filter(Boolean)
				.join(' — ')
		)
		this.tray.setContextMenu(Menu.buildFromTemplate(this.menuTemplate(targets, building, failing)))
	}

	private menuTemplate(targets: MenuBarItem[], building: MenuBarItem[], failing: MenuBarItem[]): MenuItemConstructorOptions[] {
		const items: MenuItemConstructorOptions[] = []
		const { openWindow } = this.options

		if (!this.summary) {
			items.push({ label: this.lastError ? `Can't reach Overwatcher: ${this.lastError}` : 'Loading…', enabled: false })
		} else if (!this.summary.connected) {
			items.push({ label: 'No Vercel or Railway account connected', enabled: false })
			items.push({ label: 'Connect Accounts…', click: () => openWindow('/accounts') })
		} else {
			items.push({ label: `Updated ${timeAgo(this.summary.fetchedAt)}`, enabled: false })
			for (const e of this.summary.errors) {
				items.push({ label: `⚠︎ ${e.provider}: ${e.message}`, enabled: false })
			}

			const shown = new Set([...building, ...failing].map((t) => t.key))
			const production = targets.filter((t) => t.isProduction && !shown.has(t.key))
			const previews = targets.filter((t) => !t.isProduction && !shown.has(t.key)).slice(0, MAX_PREVIEWS)

			this.section(items, 'In Progress', building)
			this.section(items, 'Failing', failing)
			this.section(items, 'Production', production)
			this.section(items, 'Recent Previews', previews)
			if (targets.length === 0) items.push({ label: 'No deployments yet', enabled: false })
		}

		items.push(
			{ type: 'separator' },
			{ label: 'Open Overwatcher', accelerator: 'CommandOrControl+O', click: () => openWindow('/') },
			{ label: 'Refresh Now', accelerator: 'CommandOrControl+R', click: () => void this.refresh() }
		)
		if (app.isPackaged) {
			items.push({
				label: 'Launch at Login',
				type: 'checkbox',
				checked: app.getLoginItemSettings().openAtLogin,
				click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
			})
		}
		items.push({ type: 'separator' }, { label: 'Quit Overwatcher', accelerator: 'CommandOrControl+Q', click: () => this.options.quit() })
		return items
	}

	private section(items: MenuItemConstructorOptions[], title: string, list: MenuBarItem[]): void {
		if (list.length === 0) return
		items.push({ type: 'separator' }, { label: title, type: 'header' })
		for (const t of list.slice(0, MAX_PER_SECTION)) items.push(this.deploymentItem(t))
		if (list.length > MAX_PER_SECTION) {
			items.push({ label: `${list.length - MAX_PER_SECTION} more…`, click: () => this.options.openWindow('/') })
		}
	}

	private deploymentItem(t: MenuBarItem): MenuItemConstructorOptions {
		const open = (url: string) => () => void shell.openExternal(url)
		const submenu: MenuItemConstructorOptions[] = [
			{ label: `${STATE_LABEL[t.state]} · ${t.provider === 'vercel' ? 'Vercel' : 'Railway'} · ${timeAgo(t.createdAt)}`, enabled: false }
		]
		if (t.url && t.state !== 'removed') submenu.push({ label: `Open ${new URL(t.url).host}`, click: open(t.url) })
		if (t.dashboardUrl) {
			submenu.push({ label: t.provider === 'vercel' ? 'Inspect on Vercel' : 'View Logs on Railway', click: open(t.dashboardUrl) })
		}
		if (t.sha || t.pr) submenu.push({ type: 'separator' })
		if (t.pr) {
			const label = `PR #${t.pr.number}${t.pr.title ? `: ${t.pr.title}` : ''}${t.pr.state === 'merged' ? ' (merged)' : ''}`
			submenu.push({ label, enabled: !!t.pr.url, click: t.pr.url ? open(t.pr.url) : undefined })
		}
		if (t.sha) {
			submenu.push({
				label: `Commit ${t.sha.slice(0, 7)}${t.message ? `: ${t.message}` : ''}`,
				enabled: !!t.commitUrl,
				click: t.commitUrl ? open(t.commitUrl) : undefined
			})
			submenu.push({ label: 'Copy Commit SHA', click: () => clipboard.writeText(t.sha!) })
		}

		return {
			label: `${t.name} — ${t.environment}`,
			sublabel: [t.branch, t.message, timeAgo(t.createdAt)].filter(Boolean).join(' · '),
			icon: DOTS[t.state],
			submenu
		}
	}
}
