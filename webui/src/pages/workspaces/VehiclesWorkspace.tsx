import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { ApiError } from '../../api/client'
import {
  deleteVehicles,
  getVehicleFleet,
  getVehicleIntegrity,
  repairVehicle,
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
import { DetailPanel } from '../../components/platform/DetailPanel'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { ViewportNotice } from '../../components/ViewportNotice'
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

function isRecoveryRecord(vehicle: VehicleFleetRow) {
  return (vehicle.actor_state ?? '').split(',').some(state => state.trim() === 'VehicleRecovery')
}

function VehicleFleetWorkspace() {
  const [vehicles, setVehicles] = useState<VehicleFleetRow[] | null>(null)
  const [source, setSource] = useState<DataSource | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
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
  const integrityRefresh = useRef<() => Promise<void>>(async () => {})
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set())
  const [deleteTargets, setDeleteTargets] = useState<VehicleFleetRow[]>([])

  const load = useCallback(async () => {
    setError('')
    setUnavailable(false)
    setRefreshing(true)
    try {
      const fleet = await getVehicleFleet()
      setVehicles(fleet.vehicles ?? [])
      setSource(fleet.source)
      setObservedAt(fleet.observed_at)
      setStaleAfterSeconds(fleet.stale_after_seconds ?? 20)
      setReadFailed(false)
    } catch (loadError: unknown) {
      setReadFailed(true)
      const missingRoute = loadError instanceof ApiError
        && (loadError.status === 404 || loadError.message.includes('No route for'))
      if (missingRoute) {
        setUnavailable(true)
      } else {
        setError(errorMessage(loadError))
      }
    }
    setNow(Date.now())
    setRefreshing(false)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const age = observedAt ? (now - Date.parse(observedAt)) / 1000 : Number.NaN
  const fresh = !readFailed && !refreshing && age >= 0 && age < staleAfterSeconds

  const repairSelectedVehicle = useCallback(async (vehicle: VehicleFleetRow) => {
    setBusy(`repair:${vehicle.id}`); setError(''); setMessage('')
    try {
      const result = await repairVehicle(vehicle.id)
      await new Promise(resolve => window.setTimeout(resolve, 2000))
      await Promise.all([load(), integrityRefresh.current()])
      setMessage(result.message)
    } catch (repairError) {
      setError(errorMessage(repairError))
    } finally {
      setBusy(null)
    }
  }, [load])
  const removeVehicle = useCallback(async () => {
    if (deleteTargets.length === 0) return
    const ids = deleteTargets.map(vehicle => vehicle.id)
    setDeleteTargets([])
    setBusy('delete'); setError('')
    setMessage('Deleting vehicle. Backup and battlegroup restart usually take 1–5 minutes.')
    try {
      const result = await deleteVehicles(ids)
      setMessage(result.message)
      setSelectedForDeletion(new Set())
      setSelectedId(null)
      await load()
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setBusy(null)
    }
  }, [deleteTargets, load])

  const loading = vehicles === null
  const selectedVehicle = vehicles?.find(vehicle => vehicle.id === selectedId)
  const matchingVehicles = vehicles?.filter(vehicle => `${vehicleLabel(vehicle)} ${vehicle.subtype ?? ''} ${vehicle.owners ?? ''} ${vehicle.permissions?.map(permission => permission.character_name).join(' ') ?? ''} ${vehicle.map ?? ''} ${vehicle.id}`.toLowerCase().includes(search.trim().toLowerCase())) ?? []
  const visibleVehicles = matchingVehicles.filter(vehicle => !isRecoveryRecord(vehicle))
  const recoveryVehicles = matchingVehicles.filter(isRecoveryRecord)
  const fleetCount = vehicles?.filter(vehicle => !isRecoveryRecord(vehicle)).length ?? 0
  const recoveryCount = (vehicles?.length ?? 0) - fleetCount
  const operationFeedback = <>
    {error && <ViewportNotice kind="err" text={error} onDismiss={() => setError('')} />}
    {message && <ViewportNotice kind="ok" text={message} onDismiss={() => setMessage('')} />}
  </>
  const repairButton = (vehicle: VehicleFleetRow) => <button className="btn-primary shrink-0"
    disabled={busy !== null || source !== 'live'}
    onClick={() => { void repairSelectedVehicle(vehicle) }}>
    <Icon name={busy === `repair:${vehicle.id}` ? 'Loader2' : 'Wrench'} size={14} className={busy === `repair:${vehicle.id}` ? 'animate-spin' : undefined} />
    {busy === `repair:${vehicle.id}` ? 'Repairing...' : 'Repair vehicle'}
  </button>
  const selectedVehicles = visibleVehicles.filter(vehicle => selectedForDeletion.has(vehicle.id))

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
                {source === 'live' ? <FreshnessBadge
                  state={fresh ? 'fresh' : 'stale'}
                  observedAt={observedAt}
                  label={`${fleetCount} fleet vehicle${fleetCount === 1 ? '' : 's'}${recoveryCount ? ` · ${recoveryCount} recovery record${recoveryCount === 1 ? '' : 's'}` : ''}`}
                /> : <span>{vehicles.length} sample vehicles</span>}
                <SourceBadge source={source ?? undefined} />
              </div>
              <div className="flex flex-wrap gap-2">
                {local && <button
                  className="btn-danger"
                  disabled={busy !== null || source !== 'live' || selectedVehicles.length === 0}
                  onClick={() => {
                    setError('')
                    setDeleteTargets(selectedVehicles)
                  }}
                >
                  <Icon name={busy === 'delete' ? 'Loader2' : 'Trash2'} size={14} className={busy === 'delete' ? 'animate-spin' : undefined} />
                  {busy === 'delete' ? 'Restarting BG & deleting… 1–5 min' : `Delete selected (${selectedVehicles.length})`}
                </button>}
                <button className="btn-secondary" disabled={busy !== null || refreshing} onClick={() => { void load() }}>
                  <Icon name="RefreshCw" size={14} />
                  Refresh
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-warning">Deleting one or more selected vehicles requires one restart of the entire battlegroup.</p>
            {!fresh && <p className="mb-3 text-xs text-text-muted">Displayed values may be older than the game. Repair and delete recheck current database state when run.</p>}
            <label className="operations-search"><Icon name="Search" size={17} /><input type="search" aria-label="Search vehicle fleet" placeholder="Vehicle, subtype, permission holder, map or ID" value={search} onChange={event => setSearch(event.target.value)} /></label>
            {visibleVehicles.length === 0 ? (
              <DataState state="empty" title={search.trim() ? 'No active vehicles match this search' : 'No active vehicles found'} />
            ) : (
              <ul className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
                {visibleVehicles.map(vehicle => (
                    <li key={vehicle.id} className="min-w-0 rounded-lg border border-border bg-surface-2 p-4">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 gap-3">
                          {local && <label className="flex min-h-11 shrink-0 items-start pt-1" title={vehicle.deletion_blocked_reason || 'Select vehicle for deletion'}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${vehicleLabel(vehicle)} for deletion`}
                              checked={selectedForDeletion.has(vehicle.id)}
                              disabled={source !== 'live' || Boolean(vehicle.deletion_blocked_reason)}
                              onChange={event => {
                                setSelectedForDeletion(current => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(vehicle.id)
                                  else next.delete(vehicle.id)
                                  return next
                                })
                              }}
                            />
                          </label>}
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-semibold text-text">{vehicleLabel(vehicle)}</h3>
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
                          {vehicle.deletion_blocked_reason && <p className="mt-2 text-xs text-warning">{vehicle.deletion_blocked_reason}</p>}
                          </div>
                        </div>
                        <button className="btn-secondary shrink-0" onClick={() => setSelectedId(vehicle.id)} aria-label={`Inspect ${vehicleLabel(vehicle)}`}>Inspect vehicle<Icon name="ArrowUpRight" size={15} /></button>
                      </div>
                    </li>
                ))}
              </ul>
            )}
            {recoveryVehicles.length > 0 && (
              <details className="mt-4 rounded-lg border border-border bg-surface-2">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text">
                  Recovery records ({recoveryVehicles.length})
                  <span className="ml-2 font-normal text-text-muted">Stored separately from the active fleet</span>
                </summary>
                <ul className="divide-y divide-border border-t border-border px-4">
                  {recoveryVehicles.map(vehicle => (
                    <li key={vehicle.id} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium text-text">{vehicleLabel(vehicle)}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          Actor {vehicle.id} · {vehicle.owners || 'Unclaimed'} · {vehicle.map || 'Map not reported'}
                        </p>
                      </div>
                      <button className="btn-secondary shrink-0" onClick={() => setSelectedId(vehicle.id)} aria-label={`Inspect ${vehicleLabel(vehicle)}`}>
                        Inspect
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
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
        <VehicleModuleIntegrity vehicleId={selectedVehicle.id} refreshRef={integrityRefresh} />
        {selectedVehicle.cargo_hold_count === 1 && <Link className="btn-secondary mb-4" to={`/vehicles?view=cargo&scope_type=vehicle&scope_id=${selectedVehicle.id}`}>Inspect cargo ({selectedVehicle.cargo_stack_count ?? '?'} stacks)</Link>}
        <p className="mb-4 text-xs text-text-muted">Repair restores every installed module to its catalog or recorded maximum durability.</p>
        {selectedVehicle.deletion_blocked_reason && (
          <p className="mb-3 text-sm text-warning" role="status">{selectedVehicle.deletion_blocked_reason}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {repairButton(selectedVehicle)}
        </div>
      </DetailPanel>}
      {deleteTargets.length > 0 && (
        <ConfirmationModal
          title={`Restart the entire battlegroup and delete ${deleteTargets.length} vehicle${deleteTargets.length === 1 ? '' : 's'}?`}
          description={`${deleteTargets.length} selected vehicle${deleteTargets.length === 1 ? '' : 's'} will be permanently deleted. Every connected player will be disconnected while DST backs up the database, stops the entire battlegroup once, deletes and verifies the selection, then restarts the battlegroup. This usually takes 1–5 minutes.`}
          confirmLabel={`Restart BG & delete ${deleteTargets.length}`}
          onCancel={() => setDeleteTargets([])}
          onConfirm={() => { void removeVehicle() }}
        >
          <ul className="space-y-2 text-sm">
            {deleteTargets.map(vehicle => <li key={vehicle.id}>{vehicleLabel(vehicle)} · Actor {vehicle.id}</li>)}
          </ul>
          <p className="mt-4 text-sm text-warning">This cannot be undone. Keep all players offline until DST reports that the battlegroup restarted.</p>
        </ConfirmationModal>
      )}
    </WorkspaceLayout>
  )
}

function VehicleModuleIntegrity({
  vehicleId,
  refreshRef,
}: {
  vehicleId: number
  refreshRef: MutableRefObject<() => Promise<void>>
}) {
  const [result, setResult] = useState<VehicleIntegrity | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setResult(null)
    setError('')
    try {
      setResult(await getVehicleIntegrity(vehicleId))
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }, [vehicleId])
  useEffect(() => {
    refreshRef.current = load
    void load()
    return () => { refreshRef.current = async () => {} }
  }, [load, refreshRef])
  return <section className="mb-4" aria-label="Persisted module integrity">
    <h3 className="font-semibold">Persisted module integrity</h3>
    {error ? <DataState state="error" title="Module integrity unavailable" message={error} /> : !result ? <DataState state="loading" title="Loading modules" /> : <>
      <p className="my-2 text-xs text-text-muted">Database observed {new Date(result.observed_at).toLocaleString()}; not live game memory.</p>
      {!result.modules.length && <p className="text-sm text-text-muted">No installed modules reported.</p>}
      <ul className="space-y-3">{result.modules.map(module => <li key={module.id} className="break-words text-sm">
        <p>{module.template_id} <span className="text-text-muted">({module.id})</span></p>
        <p>Current {module.current_durability ?? 'not reported'} / repair target {module.repair_max_durability ?? module.max_durability ?? module.decayed_max_durability ?? 'not available'}</p>
      </li>)}</ul>
    </>}
  </section>
}

function VehicleCargoWorkspace() {
  const search = useSearch()
  const params = new URLSearchParams(search)
  const requestedVehicleId = params.get('scope_type') === 'vehicle' ? params.get('scope_id') : null
  const vehicleId = requestedVehicleId && /^\d+$/.test(requestedVehicleId) && Number(requestedVehicleId) > 0
    ? Number(requestedVehicleId)
    : null

  return (
    <WorkspaceLayout workspace={getWorkspace('vehicles')} tabs={TABS} activeTab="cargo">
      {!vehicleId ? (
        <WorkspaceSection
          id="vehicle-cargo-selection"
          title="Choose a vehicle"
          description="Cargo belongs to a vehicle, not a selected player. Open a vehicle from Fleet, then choose Inspect cargo."
        >
          <DataState
            state="empty"
            title="No vehicle selected"
            message="Return to Fleet and inspect the vehicle whose persisted cargo you want to view."
            action={<Link className="btn-primary" to="/vehicles?view=fleet">Choose from fleet</Link>}
          />
        </WorkspaceSection>
      ) : (
        <SharedInventoryExplorer
          entityTypes={['vehicle']}
          title={`Vehicle cargo · Actor ${vehicleId}`}
          description="Read-only items from this vehicle's persisted actor-owned cargo hold. Player selection does not apply."
        />
      )}
    </WorkspaceLayout>
  )
}

export default function VehiclesWorkspace() {
  const view = new URLSearchParams(useSearch()).get('view')
  if (view !== 'cargo') return <VehicleFleetWorkspace />
  return <VehicleCargoWorkspace />
}
