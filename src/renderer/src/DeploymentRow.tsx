import type { Deployment } from '../../shared/types'
import { duration, firstLine, STATE_LABEL, timeAgo } from './format'

export function DeploymentRow({ d }: { d: Deployment }) {
  const c = d.commit
  const buildTime = d.state === 'ready' || d.state === 'error' ? duration(d.createdAt, d.updatedAt) : undefined

  return (
    <article className={`row state-${d.state}`}>
      <div className="row-status" title={`${STATE_LABEL[d.state]} (${d.rawStatus})`}>
        <span className={`dot ${d.state}`} />
      </div>

      <div className="row-main">
        <div className="row-head">
          <span className="project">{d.project}</span>
          {d.service && <span className="service">/ {d.service}</span>}
          <span className={`env ${d.isProduction ? 'prod' : ''}`}>{d.environment}</span>
          <span className={`provider ${d.provider}`}>{d.provider === 'vercel' ? 'Vercel' : 'Railway'}</span>
          <span className={`state-label ${d.state}`}>{STATE_LABEL[d.state]}</span>
        </div>

        <div className="row-commit">
          {c ? (
            <>
              <span className="message" title={c.message}>
                {firstLine(c.message) ?? 'No commit message'}
              </span>
            </>
          ) : (
            <span className="message muted">Deployed without a linked commit</span>
          )}
        </div>

        <div className="row-meta">
          {d.pr && (
            <Link className={`chip pr ${d.pr.state ?? ''}`} href={d.pr.url} title={d.pr.title}>
              <PrIcon />#{d.pr.number}
              {d.pr.title && <span className="pr-title">{d.pr.title}</span>}
            </Link>
          )}
          {c?.branch && (
            <span className="chip branch" title={c.branch}>
              <BranchIcon />
              {c.branch}
            </span>
          )}
          {c && (
            <Link className="chip sha" href={c.url} title={c.repo ? `${c.repo}@${c.sha}` : c.sha}>
              {c.sha.slice(0, 7)}
            </Link>
          )}
          {c?.repo && <span className="repo muted">{c.repo}</span>}
          {(c?.author ?? d.creator) && (
            <span className="author muted">
              {c?.authorAvatar && <img src={c.authorAvatar} alt="" />}
              {c?.author ?? d.creator}
            </span>
          )}
        </div>
      </div>

      <div className="row-side">
        <span className="time" title={new Date(d.createdAt).toLocaleString()}>
          {timeAgo(d.createdAt)}
        </span>
        {buildTime && <span className="muted small">{buildTime}</span>}
        <div className="row-actions">
          {d.url && d.state !== 'removed' && (
            <Link className="action" href={d.url} title={d.url}>
              Visit
            </Link>
          )}
          {d.dashboardUrl && (
            <Link className="action" href={d.dashboardUrl} title="Open in dashboard">
              {d.provider === 'vercel' ? 'Inspect' : 'Logs'}
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

function Link(props: { href?: string; className?: string; title?: string; children: React.ReactNode }) {
  if (!props.href) return <span className={props.className} title={props.title}>{props.children}</span>
  return (
    <a
      className={props.className}
      href={props.href}
      title={props.title}
      onClick={(e) => {
        e.preventDefault()
        void window.overwatcher.openExternal(props.href!)
      }}
    >
      {props.children}
    </a>
  )
}

const PrIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
    <circle cx="4" cy="3.5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="4" cy="12.5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="12" cy="12.5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 5.25v5.5M12 10.75V6a2 2 0 0 0-2-2H7.5m0 0L9 2.5M7.5 4 9 5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

const BranchIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
    <circle cx="4.5" cy="3.5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="4.5" cy="12.5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="11.5" cy="5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4.5 5.25v5.5M11.5 6.75c0 3-7 2-7 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
