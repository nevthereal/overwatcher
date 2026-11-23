import { error } from '@sveltejs/kit'

/**
 * Capabilities the Electron main process provides to the SvelteKit server, which runs in the
 * same process. Set on `globalThis` before the server starts (see electron/main.ts), so that
 * SvelteKit code never imports `electron` directly.
 */
export interface OverwatcherHost {
	/** Encrypts with the OS keychain (Electron safeStorage). Returns base64. */
	encrypt(plain: string): string
	decrypt(base64: string): string
	/** Directory for app data (Electron's userData). */
	dataDir: string
	/** Per-launch secret the window sends as a cookie; requests without it are rejected. */
	secret: string
	demo: boolean
}

declare global {
	var __overwatcherHost: OverwatcherHost | undefined
}

export function host(): OverwatcherHost {
	const h = globalThis.__overwatcherHost
	if (!h) error(503, 'Overwatcher must be started through its Electron shell (bun run dev).')
	return h
}
