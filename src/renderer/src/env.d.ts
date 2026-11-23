/// <reference types="vite/client" />
import type { OverwatcherApi } from '../../shared/types'

declare global {
  interface Window {
    overwatcher: OverwatcherApi
  }
}
