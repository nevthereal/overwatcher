import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ConnectionStatus, Deployment, FetchResult, ProviderError, ProviderId } from '../shared/types'
import { getAccount, getToken, removeCredential, saveCredential } from './store'
import { fetchVercelDeployments, verifyVercel } from './providers/vercel'
import { fetchRailwayDeployments, verifyRailway } from './providers/railway'
import { enrichWithGithub, tokenFromGhCli, verifyGithub } from './providers/github'
import { DEMO, demoConnections, demoDeployments } from './demo'

const PROVIDERS: ProviderId[] = ['vercel', 'railway', 'github']

const verifiers: Record<ProviderId, (token: string) => Promise<string>> = {
  vercel: verifyVercel,
  railway: verifyRailway,
  github: verifyGithub
}

function status(provider: ProviderId): ConnectionStatus {
  const token = getToken(provider)
  return { provider, connected: !!token, account: token ? getAccount(provider) : undefined }
}

async function connect(provider: ProviderId, token: string): Promise<ConnectionStatus> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error('Token is empty')
  const account = await verifiers[provider](trimmed)
  saveCredential(provider, trimmed, account)
  return { provider, connected: true, account }
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function fetchDeployments(): Promise<FetchResult> {
  const errors: ProviderError[] = []
  const deployments: Deployment[] = []

  const sources: [ProviderId, (t: string) => Promise<Deployment[]>][] = [
    ['vercel', fetchVercelDeployments],
    ['railway', fetchRailwayDeployments]
  ]

  await Promise.all(
    sources.map(async ([provider, fetcher]) => {
      const token = getToken(provider)
      if (!token) return
      try {
        deployments.push(...(await fetcher(token)))
      } catch (err) {
        errors.push({ provider, message: errorMessage(err) })
      }
    })
  )

  deployments.sort((a, b) => b.createdAt - a.createdAt)

  const ghToken = getToken('github')
  if (ghToken) {
    try {
      await enrichWithGithub(ghToken, deployments)
    } catch (err) {
      errors.push({ provider: 'github', message: errorMessage(err) })
    }
  }

  return { deployments, errors, fetchedAt: Date.now() }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Overwatcher',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // Every link opens in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  app.setName('Overwatcher')

  ipcMain.handle('connections:get', () => (DEMO ? demoConnections : PROVIDERS.map(status)))
  ipcMain.handle('connections:connect', (_e, provider: ProviderId, token: string) => connect(provider, token))
  ipcMain.handle('connections:github-cli', async () => connect('github', await tokenFromGhCli()))
  ipcMain.handle('connections:disconnect', (_e, provider: ProviderId) => removeCredential(provider))
  ipcMain.handle('deployments:fetch', () => (DEMO ? demoDeployments() : fetchDeployments()))
  ipcMain.handle('shell:open', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
