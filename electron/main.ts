import { app, BrowserWindow, Notification, nativeImage, nativeTheme, powerMonitor, safeStorage, session, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MenuBar } from './menu-bar.js'

/** Must match src/lib/server/host.ts */
interface OverwatcherHost {
	encrypt(plain: string): string
	decrypt(base64: string): string
	dataDir: string
	secret: string
	demo: boolean
}

declare global {
	var __overwatcherHost: OverwatcherHost | undefined
}

const SESSION_COOKIE = 'overwatcher_session'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dev = process.env.OVERWATCHER_DEV === '1' && !app.isPackaged

app.setName('Overwatcher')
// Keep development data (tokens, single-instance lock) apart from the installed app.
if (dev) app.setPath('userData', join(app.getPath('appData'), 'Overwatcher Dev'))

if (!app.requestSingleInstanceLock()) {
	app.exit(0)
}

// The SvelteKit server runs in this process and reaches Electron only through this object.
globalThis.__overwatcherHost = {
	encrypt(plain) {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error('OS encryption is unavailable, refusing to store the token in plain text.')
		}
		return safeStorage.encryptString(plain).toString('base64')
	},
	decrypt: (base64) => safeStorage.decryptString(Buffer.from(base64, 'base64')),
	dataDir: app.getPath('userData'),
	secret: randomBytes(32).toString('hex'),
	demo: process.env.OVERWATCHER_DEMO === '1'
}

/** Starts SvelteKit on 127.0.0.1 and returns its URL. */
async function startServer(): Promise<string> {
	if (dev) {
		const { createServer: createViteServer } = await import('vite')
		const vite = await createViteServer({ root, server: { host: '127.0.0.1' } })
		await vite.listen()
		const url = vite.resolvedUrls?.local[0]
		if (!url) throw new Error('Vite dev server did not report a URL')
		return url
	}

	type Handler = (req: IncomingMessage, res: ServerResponse) => void
	let handler: Handler | undefined
	const server = createServer((req, res) => handler!(req, res))
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

	// adapter-node reads ORIGIN when the handler module loads, and otherwise assumes https,
	// which would fail SvelteKit's CSRF check for form and remote function calls.
	process.env.ORIGIN = origin
	;({ handler } = (await import(pathToFileURL(join(root, 'out/web/handler.js')).href)) as { handler: Handler })
	return `${origin}/`
}

let serverUrl = ''
let mainWindow: BrowserWindow | undefined
/** True only when quitting for real (menu bar "Quit", logout, shutdown). */
let quitting = false
let toldAboutMenuBar = false

async function createWindow(path = '/'): Promise<void> {
	await session.defaultSession.cookies.set({
		url: serverUrl,
		name: SESSION_COOKIE,
		value: globalThis.__overwatcherHost!.secret,
		httpOnly: true,
		sameSite: 'strict'
	})

	const win = new BrowserWindow({
		width: 1180,
		height: 780,
		minWidth: 760,
		minHeight: 480,
		show: false,
		title: 'Overwatcher',
		titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
		trafficLightPosition: { x: 14, y: 14 },
		backgroundColor: '#09090b',
		webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
	})
	mainWindow = win
	win.on('closed', () => {
		if (mainWindow === win) mainWindow = undefined
	})
	win.once('ready-to-show', () => win.show())

	const origin = new URL(serverUrl).origin
	const openOutside = (target: string) => {
		if (/^https?:\/\//.test(target)) void shell.openExternal(target)
	}

	// Links to other sites open in the user's browser, never inside the app.
	win.webContents.setWindowOpenHandler(({ url: target }) => {
		openOutside(target)
		return { action: 'deny' }
	})
	win.webContents.on('will-navigate', (event, target) => {
		if (new URL(target).origin !== origin) {
			event.preventDefault()
			openOutside(target)
		}
	})

	await win.loadURL(new URL(path, serverUrl).href)
}

/** Brings the app back to the foreground (Dock icon included) and shows the window. */
function openWindow(path?: string): void {
	void app.dock?.show()
	if (!mainWindow) {
		void createWindow(path)
		return
	}
	if (path) void mainWindow.loadURL(new URL(path, serverUrl).href)
	if (mainWindow.isMinimized()) mainWindow.restore()
	mainWindow.show()
	mainWindow.focus()
}

/**
 * Quitting from the Dock or with Cmd-Q only closes the window and hides the Dock icon;
 * Overwatcher keeps watching from the menu bar until "Quit Overwatcher" is chosen there.
 */
function moveToMenuBar(): void {
	for (const win of BrowserWindow.getAllWindows()) win.destroy()
	app.dock?.hide()
	if (!toldAboutMenuBar && Notification.isSupported()) {
		toldAboutMenuBar = true
		new Notification({
			title: 'Overwatcher is still running',
			body: 'It keeps watching your deployments from the menu bar. Choose Quit Overwatcher there to exit.',
			silent: true
		}).show()
	}
}

function quitForReal(): void {
	quitting = true
	app.quit()
}

/**
 * In development the Dock shows the stock Electron.app bundle, so set our icon at runtime and
 * follow light/dark mode. Packaged builds use the Icon Composer icon, which macOS themes itself.
 */
function useDevDockIcon(): void {
	if (!dev || !app.dock) return
	const apply = () => {
		const variant = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
		app.dock?.setIcon(nativeImage.createFromPath(join(root, 'resources/dock', `${variant}.png`)))
	}
	apply()
	nativeTheme.on('updated', apply)
}

app.whenReady().then(async () => {
	useDevDockIcon()
	serverUrl = await startServer()

	new MenuBar({
		serverUrl,
		cookie: `${SESSION_COOKIE}=${globalThis.__overwatcherHost!.secret}`,
		resourcesDir: join(root, 'resources'),
		openWindow,
		quit: quitForReal
	})

	await createWindow()

	// Dock icon clicked, or the app launched again while running in the menu bar.
	app.on('activate', () => openWindow())
	app.on('second-instance', () => openWindow())
})

app.on('before-quit', (event) => {
	if (quitting || process.platform !== 'darwin') return
	event.preventDefault()
	moveToMenuBar()
})

// Never block logout, restart or shutdown.
powerMonitor.on('shutdown', () => {
	quitting = true
})

// On macOS closing the last window keeps the app (and its menu bar item) running.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
