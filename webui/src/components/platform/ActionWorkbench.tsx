import { useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon'
import './actionWorkbench.css'

type WorkbenchAction = {
  id: string
  label: string
  icon: string
  group: string
  rowNote?: string
  liveOnly?: boolean
  offlineOnly?: boolean
  experimental?: boolean
}

export function ActionWorkbench<T extends WorkbenchAction>({ actions, selectedId, onSelect, renderAction, busy, title, target }: {
  actions: readonly T[]
  selectedId: string | null
  onSelect: (id: string) => void
  renderAction: (action: T) => ReactNode
  busy: boolean
  title: string
  target: string
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const headingId = useId()
  const detail = useRef<HTMLDivElement>(null)
  const groups = [...new Set(actions.map(action => action.group))]
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = actions.filter(action => (!group || action.group === group)
    && words.every(word => `${action.label} ${action.group} ${action.rowNote ?? ''}`.toLowerCase().includes(word)))
  const selected = actions.find(action => action.id === selectedId)
  return (
    <section className="action-workbench" aria-labelledby={headingId}>
      <header>
        <h3 id={headingId}>{title}</h3>
        <p>Choose a task for <strong>{target}</strong>. Selecting a task does not run it.</p>
      </header>
      <div className="action-workbench-filters">
        <label><Icon name="Search" size={16} /><input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder="Find an action..." value={query} onChange={event => setQuery(event.target.value)} /></label>
        {groups.length > 1 && <select aria-label="Action category" value={group} onChange={event => setGroup(event.target.value)}>
          <option value="">All categories</option>
          {groups.map(name => <option key={name} value={name}>{name}</option>)}
        </select>}
        <span>{visible.length} of {actions.length}</span>
      </div>
      <div className="action-workbench-body">
        <nav aria-label={`${title} choices`}>
          {visible.map(action => <button key={action.id} type="button" aria-pressed={action.id === selectedId} disabled={busy}
            data-danger={action.group === 'Danger'} onClick={() => {
              onSelect(action.id)
              if (window.matchMedia('(max-width: 767px)').matches) detail.current?.scrollIntoView({ block: 'nearest' })
            }}>
            <Icon name={action.icon} size={17} />
            <span><strong>{action.label}</strong><small>{action.experimental ? 'Experimental' : action.group === 'Danger' ? 'Permanent action' : action.liveOnly ? 'Online session required' : action.offlineOnly ? 'Offline player required' : action.group}</small></span>
            <Icon name="ChevronRight" size={14} />
          </button>)}
          {!visible.length && <div className="action-workbench-empty"><p>No matching actions.</p><button type="button" onClick={() => { setQuery(''); setGroup('') }}>Clear filters</button></div>}
        </nav>
        <div ref={detail} className="action-workbench-detail" aria-label="Selected action">
          {selected ? renderAction(selected) : <div className="action-workbench-empty"><Icon name="MousePointer2" size={24} /><h4>Select a task</h4><p>Its form, requirements, and confirmation appear here. Your current target remains selected.</p></div>}
        </div>
      </div>
    </section>
  )
}
