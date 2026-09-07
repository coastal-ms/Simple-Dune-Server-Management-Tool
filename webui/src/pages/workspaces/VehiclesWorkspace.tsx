import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import {
  cancelVehicleDeletion,
  getVehicleDeletionQueue,
  getVehicleFleet,
  getVehicleIntegrity,
  processVehicleDeletions,
  queueVehicleDeletion,
  type VehicleDeletionQueue,
  type VehicleFleetRow,
  type DataSource,
  type VehicleIntegrity,
} from '../../api/gameplay'
import { Icon } from '../../components/Icon'
import { SharedInventoryExplorer } from '../../components/inventory/SharedInventoryExplorer'
import { DataState, FreshnessBadge } from '../../components/platform/DataState'
import { WorkspaceLayout, WorkspaceSection, type WorkspaceTab } from '../../components/platform/WorkspaceLayout'
import { getWorkspace } from '../../platform/workspaces'
import { Link, useSearch } from '../../router'
import { useCommandDeck } from '../../hooks/useCommandDeck'
import { DetailPanel } from '../../components/platform/DetailPanel'
import { SourceBadge } from '../gameplay/shared'
import { isLocalViewer } from '../../util/viewer'

const TABS: readonly WorkspaceTab[] = [
  { id: 'fleet', label: 'Fleet', to: '/vehicles?view=fleet', icon: 'Truck' },
  { id: 'cargo', label: 'Cargo', to: '/vehicles?view=cargo', icon: 'PackageSearch' },
]

function vehicleLabel(vehicle: VehicleFleetRow) {
  return vehicle.vehicle_name?.trim() || vehicle.class || `Vehicle ${vehicle.id}`
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error)
}

function VehicleFleetWorkspace() {
  const contextual = useCommandDeck()
  const [vehicles, setVehicles] = useState<VehicleFleetRow[] | null>(null)
  const [source, setSource] = useState<DataSource | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [queue, setQueue] = useState<VehicleDeletionQueue | null>(null)
  const [queueError, setQueueError] = useState('')
  const [observedAt, setObservedAt] = useState<string>()
  const [staleAfterSeconds, setStaleAfterSeconds] = useState(20)
  const [now, setNow] = useState(Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [readFailed, setReadFailed] = useState(false)
  const local = isLocalViewer()
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    setUnavailable(false)
    setQueueError('')
    setRefreshing(true)
    const [fleet, deletions] = await Promise.allSettled([
      getVehicleFleet(), local ? getVehicleDeletionQueue() : Promise.resolve(null),
    ])
    if (fleet.status === 'fulfilled') {
      setVehicles(fleet.value.vehicles ?? [])
      setSource(fleet.value.source)
      setObservedAt(fleet.value.observed_at)
      setStaleAfterSeconds(fleet.value.stale_after_seconds ?? 20)
      setReadFailed(false)
    } else {
      const loadError: unknown = fleet.reason
      setReadFailed(true)
      const missingRoute = loadError instanceof ApiError
        && (loadError.status === 404 || loadError.message.includes('No route for'))
      if (missingRoute) {
        setUnavailable(true)
      } else {
        setError(errorMessage(loadError))
      }
    }
    if (deletions.status === 'fulfilled') setQueue(deletions.value)
    else { setQueue(null); setQueueError(errorMessage(deletions.reason)) }
    setNow(Date.now())
    setRefreshing(false)
  }, [local])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const age = observedAt ? (now - Date.parse(observedAt)) / 1000 : Number.NaN
  const fresh = !readFailed && !refreshing && age >= 0 && age < staleAfterSeconds

  const queuedVehicleIds = useMemo(
    () => new Set((queue?.entries ?? []).map(entry => entry.vehicle_id)),
    [queue?.entries],
  )

  const queueDeletion = useCallback(async (vehicle: VehicleFleetRow) => {
    if (!local || !fresh || !vehicle.target_revision || vehicle.deletion_blocked_reason) return
    const required = `DELETE ${vehicle.id}`
    const typed = window.prompt(
      `Queue permanent removal of ${vehicleLabel(vehicle)} (actor ${vehicle.id})?\n`
      + `Map: ${vehicle.map || 'Not reported'}\nOwner: ${vehicle.owners || 'Unclaimed'}\n`
      + `Modules: ${vehicle.module_count ?? 'Not reported'}; cargo stacks: ${vehicle.cargo_stack_count ?? 'Not reported'}\n\n`
      + 'The vehicle, modules, stored items, ownership, markers, and recovery records will be removed during the next safe deletion window. '
      + 'A full database safety backup is mandatory before anything is deleted.\n\n'
      + `Type ${required} to continue.`,
    )
    if (typed !== required) {
      if (typed !== null) setError(`Removal was not queued because the confirmation did not match ${required}.`)
      return
    }
    setBusy(`queue:${vehicle.id}`); setError(''); setMessage('')
    try {
      const result = await queueVehicleDeletion(vehicle.id, typed, vehicle.target_revision)
      setMessage(result.message)
      await load()
    } catch (queueError) {
      setError(errorMessage(queueError))
    } finally {
      setBusy(null)
    }
  }, [load, local, fresh])

  const cancelDeletion = useCallback(async (entryId: string) => {
    setBusy(`cancel:${entryId}`); setError(''); setMessage('')
    try {
      const result = await cancelVehicleDeletion(entryId)
      setMessage(result.message)
      await load()
    } catch (cancelError) {
      setError(errorMessage(cancelError))
    } finally {
      setBusy(null)
    }
  }, [load])

  const processQueue = useCallback(async () => {
    if (!local || !queue?.revision || queue.running) return
    const required = 'RESTART AND DELETE'
    const typed = window.prompt(
      'Open the safe vehicle deletion window now?\n\n'
      + 'DST will create a database backup, stop the entire battlegroup, delete and verify every queued vehicle, then start the battlegroup again. '
      + 'All connected players will be disconnected.\n\n'
      + queue.entries.map(entry => `Actor ${entry.vehicle_id}: ${entry.vehicle_name || entry.class}; ${entry.map || 'unknown map'}; owner ${entry.owners || 'unclaimed'}; ${entry.module_count ?? '?'} modules; ${entry.cargo_stack_count ?? '?'} cargo stacks`).join('\n')
      + '\n\n'
      + `Type ${required} to continue.`,
    )
    if (typed !== required) {
      if (typed !== null) setError(`Nothing changed because the confirmation did not match ${required}.`)
      return
    }
    setBusy('process'); setError(''); setMessage('')
    try {
      const result = await processVehicleDeletions(typed, queue.revision)
      setMessage(result.message)
      await load()
    } catch (processError) {
      await load()
      setError(errorMessage(processError))
    } finally {
      setBusy(null)
    }
  }, [load, local, queue])

  const loading = vehicles === null
  const selectedVehicle = vehicles?.find(vehicle => vehicle.id === selectedId)
  const visibleVehicles = vehicles?.filter(vehicle => `${vehicleLabel(vehicle)} ${vehicle.subtype ?? ''} ${vehicle.owners ?? ''} ${vehicle.permissions?.map(permission => permission.character_name).join(' ') ?? ''} ${vehicle.map ?? ''} ${vehicle.id}`.toLowerCase().includes(search.trim().toLowerCase())) ?? []
  const operationFeedback = <>
    {error && <DataState state="error" title="Vehicle operation failed" message={error} />}
    {message && (
      <div className="mb-3 rounded-lg border border-success/35 bg-success/10 px-4 py-3 text-sm text-text" role="status">
        {message}
      </div>
    )}
  </>
  const removalButton = (vehicle: VehicleFleetRow) => <button className="btn-danger shrink-0"
    disabled={!local || !fresh || !queue || busy !== null || queue.running || queuedVehicleIds.has(vehicle.id) || source !== 'live' || !vehicle.target_revision || Boolean(vehicle.deletion_blocked_reason)}
    onClick={() => { void queueDeletion(vehicle) }}>
    <Icon name={busy === `queue:${vehicle.id}` ? 'Loader2' : 'Trash2'} size={14} />
    {queuedVehicleIds.has(vehicle.id) ? 'Queued' : busy === `queue:${vehicle.id}` ? 'Queuing...' : 'Queue removal'}
  </button>

  if (loading && unavailable) {
    return (
      <WorkspaceLayout workspace={getWorkspace('vehicles')} tabs={TABS} activeTab="fleet">
        <DataState
          state="unavailable"
          title="Vehicle management is not included in this build"
          message="Install the matching DST backend build to use live fleet inventory and protected vehicle removal."
        />
      </WorkspaceLayout>
    )
  }

  if (loading && error) {
    return (
      <WorkspaceLayout workspace={getWorkspace('vehicles')} tabs={TABS} activeTab="fleet">
        <DataState
          state="error"
          title="Vehicle management unavailable"
          message={error}
          action={(
            <button className="btn-secondary" onClick={() => { void load() }}>
              <Icon name="RefreshCw" size={14} />
              Retry
            </button>
          )}
        />
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout workspace={getWorkspace('vehicles')} tabs={TABS} activeTab="fleet">
      <WorkspaceSection
        id="vehicles-fleet"
        title="Vehicle fleet"
        description="Persisted game-database fleet, including unclaimed vehicles. In-memory gameplay may be newer than the last database save. Destructive controls are host-local only."
      >
        {loading && !error && <DataState state="loading" title="Loading vehicle fleet" />}
        {!selectedVehicle && operationFeedback}
        {!loading && vehicles && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {source === 'live' ? <FreshnessBadge state={fresh ? 'fresh' : 'stale'} observedAt={observedAt} label={`${vehicles.length} persisted vehicle${vehicles.length === 1 ? '' : 's'}`} /> : <span>{vehicles.length} sample vehicles</span>}
                <SourceBadge source={source ?? undefined} />
              </div>
              <button className="btn-secondary" disabled={busy !== null || refreshing} onClick={() => { void load() }}>
                <Icon name="RefreshCw" size={14} />
                Refresh
              </button>
            </div>
            {!fresh && <p className="mb-3 text-xs text-warning">Refresh the persisted snapshot before queuing a removal.</p>}
            <label className="operations-search"><Icon name="Search" size={17} /><input type="search" aria-label="Search vehicle fleet" placeholder="Vehicle, subtype, permission holder, map or ID" value={search} onChange={event => setSearch(event.target.value)} /></label>
            {visibleVehicles.length === 0 ? (
              <DataState state="empty" title={search.trim() ? 'No vehicles match this search' : 'No vehicles found'} />
            ) : (
              <ul className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
                {visibleVehicles.map(vehicle => {
                  const queued = queuedVehicleIds.has(vehicle.id)
                  return (
                    <li key={vehicle.id} className="min-w-0 rounded-lg border border-border bg-surface-2 p-4">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-semibold text-text">{vehicleLabel(vehicle)}</h3>
                            {queued && <span className="pill border-warning/40 text-warning">Queued</span>}
                            {vehicle.actor_state && <span className="pill border-border text-text-muted">{vehicle.actor_state}</span>}
                          </div>
                          <p className="mt-1 break-all font-mono text-xs text-text-dim">Actor {vehicle.id}</p>
                          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="text-xs text-text-dim">Owners</dt>
                              <dd className="mt-0.5 break-words text-text">{vehicle.owners || 'Unclaimed'}{vehicle.ownership_status === 'ambiguous' && ' (unresolved)'}</dd>
                            </div>
                            <div><dt className="text-xs text-text-dim">Subtype</dt><dd>{vehicle.subtype || vehicle.class}</dd></div>
                            <div><dt className="text-xs text-text-dim">Cargo</dt><dd>{vehicle.cargo_hold_count === 1 ? `${vehicle.cargo_stack_count ?? '?'} persisted stacks` : vehicle.cargo_hold_count === 0 ? 'No cargo hold' : 'Not proven'}</dd></div>
                            <div>
                              <dt className="text-xs text-text-dim">Map</dt>
                              <dd className="mt-0.5 break-words text-text">{vehicle.map || 'Not reported'}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setSelectedId(vehicle.id)} aria-label={`Inspect ${vehicleLabel(vehicle)}`}>Inspect vehicle<Icon name="ArrowUpRight" size={15} /></button>{!contextual && removalButton(vehicle)}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </WorkspaceSection>

      <WorkspaceSection
        id="vehicles-deletion-queue"
        title="Safe deletion queue"
        description="Nothing is deleted while maps are live. Processing creates a labeled safety backup, stops the battlegroup, deletes and verifies every queued actor transactionally, then starts the battlegroup."
      >
        {queue?.last_error && <DataState state="error" title="Last deletion window failed" message={queue.last_error} />}
        {!local ? <DataState state="unavailable" title="Host-local removal only" message="Fleet and cargo remain readable here. Queue, cancel, and restart deletion from the DST host." /> : queueError ? <DataState state="error" title="Deletion queue unavailable" message={queueError} /> : !queue || queue.entries.length === 0 ? (
          <DataState state={queue ? 'empty' : 'loading'} title={queue ? 'No vehicles queued' : 'Loading deletion queue'} />
        ) : (
          <div className="card min-w-0 p-4">
            <ul className="divide-y divide-border">
              {queue.entries.map(entry => (
                <li key={entry.id} className="flex min-w-0 flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-words font-medium text-text">{entry.vehicle_name || entry.class || `Vehicle ${entry.vehicle_id}`}</div>
                    <p className="mt-1 break-words text-xs text-text-dim">
                      Actor {entry.vehicle_id} · {entry.owners || 'No named owner'} · queued {new Date(entry.created_at).toLocaleString()}
                    </p>
                    {entry.message && <p className="mt-1 text-xs text-text-muted">{entry.message}</p>}
                  </div>
                  <button
                    className="btn-secondary shrink-0"
                    disabled={busy !== null || queue.running || refreshing}
                    onClick={() => { void cancelDeletion(entry.id) }}
                  >
                    <Icon name={busy === `cancel:${entry.id}` ? 'Loader2' : 'X'} size={14} className={busy === `cancel:${entry.id}` ? 'animate-spin' : undefined} />
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[72ch] text-xs text-warning">
                Processing disconnects every player and restarts the full battlegroup.
              </p>
              <button className="btn-danger shrink-0" disabled={busy !== null || refreshing || queue.running || !queue.revision || source !== 'live'} onClick={() => { void processQueue() }}>
                <Icon name={busy === 'process' || queue.running ? 'Loader2' : 'ShieldAlert'} size={14} className={busy === 'process' || queue.running ? 'animate-spin' : undefined} />
                {busy === 'process' || queue.running ? 'Processing...' : `Backup, restart, and delete ${queue.entries.length}`}
              </button>
            </div>
          </div>
        )}
        {local && queue && queue.history.length > 0 && <details className="mt-4 text-sm">
          <summary className="cursor-pointer">Recent deletion outcomes</summary>
          <ul className="mt-2 space-y-3">{queue.history.slice(0, 10).map(entry => <li key={entry.id}>
            <p>Actor {entry.vehicle_id}: {entry.status} - {entry.message}</p>
            {entry.safety_backup && <p className="break-all text-xs text-text-muted">Recovery backup: {entry.safety_backup}</p>}
          </li>)}</ul>
        </details>}
      </WorkspaceSection>
      {selectedVehicle && <DetailPanel open title={vehicleLabel(selectedVehicle)} onClose={() => setSelectedId(null)}>
        {operationFeedback}
        <SourceBadge source={source ?? undefined} />
        <dl className="my-5 space-y-4 text-sm">
          <div><dt className="text-text-muted">Actor</dt><dd>{selectedVehicle.id}</dd></div>
          <div><dt className="text-text-muted">Class</dt><dd>{selectedVehicle.class || 'Not reported'}</dd></div>
          <div><dt className="text-text-muted">Owner</dt><dd>{selectedVehicle.owners || 'No named owner'}</dd></div>
          <div><dt className="text-text-muted">Map</dt><dd>{selectedVehicle.map || 'Not reported'}</dd></div>
          <div><dt className="text-text-muted">State</dt><dd>{selectedVehicle.actor_state || 'Not reported'}</dd></div>
          <div><dt className="text-text-muted">Subtype</dt><dd>{selectedVehicle.subtype || selectedVehicle.class} ({selectedVehicle.subtype_source === 'catalog' ? 'DST catalog' : 'actor class'})</dd></div>
          <div><dt className="text-text-muted">Recovery chassis integrity</dt><dd>{selectedVehicle.recovery_durability == null ? 'Not reported' : `${selectedVehicle.recovery_durability} (persisted recovery value)`}</dd></div>
          <div><dt className="text-text-muted">Recovery / backup records</dt><dd>{selectedVehicle.recovery_count ?? 'Not reported'} / {selectedVehicle.backup_count ?? 'Not reported'}</dd></div>
          <div><dt className="text-text-muted">Cargo capacity (database)</dt><dd>{selectedVehicle.cargo_max_item_count ?? 'Not reported'} item slots / {selectedVehicle.cargo_max_item_volume ?? 'not reported'} volume</dd></div>
        </dl>
        <h3 className="font-semibold">Game permission roster</h3>
        <ul className="my-3 space-y-2 text-sm">{selectedVehicle.permissions?.map(permission => <li key={`${permission.player_id}:${permission.rank}`}>
          {permission.character_name || 'Unresolved player'} - {permission.rank === 1 ? 'Owner' : permission.rank === 2 ? 'Co-Owner' : permission.rank === 3 ? 'Associate' : `Unknown rank ${permission.rank}`}
          <span className="block break-all text-xs text-text-muted">Controller {permission.player_id} / persisted rank {permission.rank}</span>
        </li>)}</ul>
        {!selectedVehicle.permissions?.length && <p className="my-3 text-sm text-text-muted">No permission holders reported.</p>}
        <p className="mb-4 text-xs text-text-muted">Roster is read-only. Server custodian is not configured; DST does not infer game access from a local label.</p>
        <VehicleModuleIntegrity vehicleId={selectedVehicle.id} />
        {selectedVehicle.cargo_hold_count === 1 && <Link className="btn-secondary mb-4" to={`/vehicles?view=cargo&scope_type=vehicle&scope_id=${selectedVehicle.id}`}>Inspect cargo ({selectedVehicle.cargo_stack_count ?? '?'} stacks)</Link>}
        {selectedVehicle.deletion_blocked_reason && <p className="mb-4 text-sm text-warning">{selectedVehicle.deletion_blocked_reason}</p>}
        <p className="mb-4 text-xs text-text-muted">Removal still requires its typed confirmation and the protected backup/restart window.</p>
        {removalButton(selectedVehicle)}
      </DetailPanel>}
    </WorkspaceLayout>
  )
}

function VehicleModuleIntegrity({ vehicleId }: { vehicleId: number }) {
  const [result, setResult] = useState<VehicleIntegrity | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setResult(null); setError('')
    getVehicleIntegrity(vehicleId).then(value => { if (active) setResult(value) })
      .catch((reason: unknown) => { if (active) setError(errorMessage(reason)) })
    return () => { active = false }
  }, [vehicleId])
  return <section className="mb-4" aria-label="Persisted module integrity">
    <h3 className="font-semibold">Persisted module integrity</h3>
    {error ? <DataState state="error" title="Module integrity unavailable" message={error} /> : !result ? <DataState state="loading" title="Loading modules" /> : <>
      <p className="my-2 text-xs text-text-muted">Database observed {new Date(result.observed_at).toLocaleString()}; not live game memory. Missing values are not full health.</p>
      {!result.modules.length && <p className="text-sm text-text-muted">No installed modules reported.</p>}
      <ul className="space-y-3">{result.modules.map(module => <li key={module.id} className="break-words text-sm">
        <p>{module.template_id} <span className="text-text-muted">({module.id})</span></p>
        <p>Current {module.current_durability ?? 'not reported'} / maximum {module.max_durability ?? 'not reported'} / decayed maximum {module.decayed_max_durability ?? 'not reported'}</p>
      </li>)}</ul>
    </>}
  </section>
}

export default function VehiclesWorkspace() {
  const view = new URLSearchParams(useSearch()).get('view')
  if (view !== 'cargo') return <VehicleFleetWorkspace />
  return (
    <WorkspaceLayout workspace={getWorkspace('vehicles')} tabs={TABS} activeTab="cargo">
      <SharedInventoryExplorer
        entityTypes={['vehicle']}
        title="Vehicle cargo"
        description="Read-only cargo from the vehicle's single actor-owned type-0 hold. Component holds are excluded. Reads observe the persisted game database, not live game memory or DST's player/storage cache."
      />
    </WorkspaceLayout>
  )
}
