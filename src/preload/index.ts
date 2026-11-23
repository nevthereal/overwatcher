import { contextBridge, ipcRenderer } from 'electron'
import type { OverwatcherApi } from '../shared/types'

const api: OverwatcherApi = {
  getConnections: () => ipcRenderer.invoke('connections:get'),
  connect: (provider, token) => ipcRenderer.invoke('connections:connect', provider, token),
  connectGithubFromCli: () => ipcRenderer.invoke('connections:github-cli'),
  disconnect: (provider) => ipcRenderer.invoke('connections:disconnect', provider),
  fetchDeployments: () => ipcRenderer.invoke('deployments:fetch'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url)
}

contextBridge.exposeInMainWorld('overwatcher', api)
