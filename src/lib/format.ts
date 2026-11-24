import type { DeploymentState } from '#lib/types.js'

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

export function dayLabel(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(date)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
  })
}

export function duration(from: number, to?: number): string | undefined {
  if (!to || to < from) return undefined
  const s = Math.round((to - from) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

export const STATE_LABEL: Record<DeploymentState, string> = {
  queued: 'Queued',
  building: 'Building',
  ready: 'Ready',
  error: 'Failed',
  canceled: 'Canceled',
  sleeping: 'Sleeping',
  removed: 'Removed',
  unknown: 'Unknown'
}

export const firstLine = (s?: string) => s?.split('\n')[0]
