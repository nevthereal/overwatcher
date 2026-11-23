import { useEffect, useState } from 'react'
import type { ConnectionStatus, ProviderId } from '../../shared/types'

const api = window.overwatcher

const PROVIDER_INFO: Record<ProviderId, { name: string; tokenUrl: string; help: string; optional?: boolean }> = {
  vercel: {
    name: 'Vercel',
    tokenUrl: 'https://vercel.com/account/settings/tokens',
    help: 'Create a token scoped to the teams you want to watch. All of its teams are included.'
  },
  railway: {
    name: 'Railway',
    tokenUrl: 'https://railway.com/account/tokens',
    help: 'Use an account token (no workspace selected) to see every workspace, or a workspace token for one.'
  },
  github: {
    name: 'GitHub',
    tokenUrl: 'https://github.com/settings/personal-access-tokens/new',
    help: 'Looks up the pull request behind each commit and fills in PR titles. Needs read access to Pull requests and Contents.',
    optional: true
  }
}

export function AccountsDialog(props: {
  connections: ConnectionStatus[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="dialog" role="dialog" aria-label="Accounts">
        <div className="dialog-head">
          <h2>Accounts</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small">Tokens are stored on this machine only, encrypted with your system keychain.</p>
        {props.connections.map((c) => (
          <AccountCard key={c.provider} status={c} onChanged={props.onChanged} />
        ))}
      </div>
    </div>
  )
}

function AccountCard({ status, onChanged }: { status: ConnectionStatus; onChanged: () => Promise<void> }) {
  const info = PROVIDER_INFO[status.provider]
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setToken('')
      await onChanged()
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className={`provider-name ${status.provider}`}>{info.name}</span>
        {info.optional && <span className="muted small">optional</span>}
        <span className="spacer" />
        {status.connected ? (
          <span className="connected">
            <span className="dot ready" /> {status.account ?? 'Connected'}
          </span>
        ) : (
          <span className="muted small">Not connected</span>
        )}
      </div>
      <p className="muted small">
        {info.help}{' '}
        <a
          href={info.tokenUrl}
          onClick={(e) => {
            e.preventDefault()
            void api.openExternal(info.tokenUrl)
          }}
        >
          Create a token ↗
        </a>
      </p>

      {status.connected ? (
        <div className="card-actions">
          <button disabled={busy} onClick={() => run(() => api.disconnect(status.provider))}>
            Disconnect
          </button>
        </div>
      ) : (
        <form
          className="card-actions"
          onSubmit={(e) => {
            e.preventDefault()
            if (token.trim()) void run(() => api.connect(status.provider, token))
          }}
        >
          <input
            type="password"
            placeholder={`${info.name} token`}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="primary" type="submit" disabled={busy || !token.trim()}>
            {busy ? 'Checking…' : 'Connect'}
          </button>
          {status.provider === 'github' && (
            <button type="button" disabled={busy} onClick={() => run(() => api.connectGithubFromCli())} title="Uses `gh auth token`">
              Use GitHub CLI
            </button>
          )}
        </form>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}

/** Strips Electron's "Error invoking remote method 'x': Error: " prefix. */
function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
