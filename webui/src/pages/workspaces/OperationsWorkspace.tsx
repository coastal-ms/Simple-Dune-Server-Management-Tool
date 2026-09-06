import { usePortalAccess } from '../../auth/portalAccess'
import { Icon } from '../../components/Icon'
import { WorkspaceLayout, WorkspaceSection } from '../../components/platform/WorkspaceLayout'
import { getWorkspace } from '../../platform/workspaces'
import { Link } from '../../router'
import { isLocalViewer } from '../../util/viewer'
import { useState } from 'react'
import { useCommandDeck } from '../../hooks/useCommandDeck'
import { useStatus } from '../../hooks/useStatus'

type OperationLink = {
  to: string
  label: string
  description: string
  icon: string
  ownerOnly?: boolean
  localOnly?: boolean
}

const OPERATION_LINKS: readonly OperationLink[] = [
  { to: '/pods', label: 'Runtime and pods', description: 'Inspect Kubernetes workload health and one-shot operations.', icon: 'Boxes' },
  { to: '/commands', label: 'Commands', description: 'Run the existing curated lifecycle actions.', icon: 'Zap' },
  { to: '/map?view=lifecycle', label: 'Map lifecycle', description: 'Manage warm maps, partitions, and map pod restarts.', icon: 'Map' },
  { to: '/broadcasts', label: 'Communications', description: 'Send existing in-game broadcasts.', icon: 'Megaphone' },
  { to: '/database', label: 'Data protection', description: 'Use the existing backup, restore, and database operations.', icon: 'Database', ownerOnly: true },
  { to: '/sietches', label: 'Topology', description: 'Configure existing Hagga shard topology.', icon: 'Network', ownerOnly: true },
  { to: '/terminal', label: 'Host tools', description: 'Open the host-local PowerShell surface.', icon: 'SquareTerminal', localOnly: true },
]

export default function OperationsWorkspace() {
  const { canAccessOwnerSurfaces } = usePortalAccess()
  const local = isLocalViewer()
  const contextual = useCommandDeck()
  const links = OPERATION_LINKS.filter(item => !item.ownerOnly || canAccessOwnerSurfaces)
    .filter(item => !item.localOnly || local)

  return (
    <WorkspaceLayout workspace={getWorkspace('operations')}>
      {contextual ? <OperationsDesk links={links} /> : <WorkspaceSection
        id="operations-current-tools"
        title="Operational tools"
        description="Existing tools remain at their compatibility URLs while the shared workspace structure settles."
      >
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/80">
          {links.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-16 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ibad"
            >
              <Icon name={item.icon} size={18} className="mt-0.5 shrink-0 text-accent-bright" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text">{item.label}</span>
                <span className="mt-0.5 block text-sm text-text-muted">{item.description}</span>
              </span>
              <Icon name="ChevronRight" size={16} className="mt-1 shrink-0 text-text-dim" />
            </Link>
          ))}
        </div>
      </WorkspaceSection>}
    </WorkspaceLayout>
  )
}

function OperationsDesk({ links }: { links: readonly OperationLink[] }) {
  const { status, error, loading, refresh } = useStatus()
  const [query, setQuery] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const visible = links.filter(link => `${link.label} ${link.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  const observed = status?.ts ? new Date(status.ts) : null
  const stamp = observed && Number.isFinite(observed.getTime()) ? observed.toLocaleString() : 'Not reported'
  const groups = [
    { title: 'Run and communicate', paths: ['/pods', '/commands', '/map?view=lifecycle', '/broadcasts'] },
    { title: 'Protect and configure', paths: ['/database', '/sietches', '/terminal'] },
  ]
  return <div className="operations-desk">
    <section className="operations-tools" aria-label="Operational tools">
      <label className="operations-search"><Icon name="Search" size={17} /><input type="search" aria-label="Search operational tools" placeholder="Find a task: backup, maps, broadcasts..." value={query} onChange={event => setQuery(event.target.value)} /></label>
      {groups.map(group => {
        const items = visible.filter(link => group.paths.includes(link.to))
        return items.length > 0 && <section key={group.title}><h2>{group.title}</h2>{items.map(link => <Link key={link.to} to={link.to}>
          <Icon name={link.icon} size={20} /><span><strong>{link.label}</strong><small>{link.description}</small></span><Icon name="ArrowUpRight" size={17} />
        </Link>)}</section>
      })}
      {!visible.length && <p>No matching tools. Try a different task name.</p>}
    </section>
    <aside className="operations-observation" aria-label="Server observation">
      <h2>Current observation</h2>
      <p>{stamp}. Reported status only; selecting a tool does not run an action.</p>
      <dl><div><dt>Virtual machine</dt><dd>{status?.vm?.state || 'Not reported'}</dd></div><div><dt>Battlegroup</dt><dd>{status?.bg?.state || 'Not reported'}</dd></div>
        <div><dt>Map instances</dt><dd>{status?.bg?.gameServers ? status.bg.gameServers.length : 'Not reported'}</dd></div></dl>
      {(error || refreshError) && <p role="status">{refreshError || error}. Last available observation shown.</p>}
      <button disabled={loading} onClick={() => {
        setRefreshError('')
        void refresh().catch(reason => setRefreshError(reason instanceof Error ? reason.message : 'Refresh failed'))
      }}>Refresh observation</button>
    </aside>
  </div>
}
