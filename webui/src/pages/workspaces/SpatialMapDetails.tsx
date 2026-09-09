import type { Player, PlayersResponse } from '../../api/gameplay'
import { useApi } from '../../hooks/useApi'
import { useHealthRefreshPreset } from '../../hooks/useHealthRefresh'
import { mapLabel } from '../../util/mapLabel'
import { LOCATION_VISUALS, spatialLocationKind, type SpatialNode } from './spatialModel'

export function connectedMapUsers(players: Player[], map: string) {
  const names = new Set([map.toLowerCase(), mapLabel(map).toLowerCase()])
  const kind = spatialLocationKind(map)
  if (!['unknown', 'dungeon', 'story'].includes(kind)) names.add(LOCATION_VISUALS[kind].label.toLowerCase())
  if (map.toLowerCase() === 'overmap') names.add('overland')
  return players.filter(player => player.online_status.toLowerCase() === 'online' && names.has(player.map.trim().toLowerCase()))
}

export default function SpatialMapDetails({ node, selected, instances, observedAt, stale, refreshIntervalMs }: {
  node: SpatialNode | undefined
  selected: boolean
  instances: number
  observedAt: string
  stale: boolean
  refreshIntervalMs?: number
}) {
  const refreshPreset = useHealthRefreshPreset()
  const roster = useApi<PlayersResponse>('/api/gameplay/players', {
    enabled: selected && !!node,
    intervalMs: refreshIntervalMs ?? refreshPreset.mapPlayersIntervalMs,
  })
  const users = node && roster.data ? connectedMapUsers(roster.data.players, node.map) : []
  const sample = roster.data?.source === 'demo'
  const failure = roster.error || roster.data?.liveError
  return <div className="spatial-map-details">
    <section aria-label="Connected users">
      <div className="spatial-detail-title"><h3>{sample ? 'Sample users' : 'Connected users'}</h3><strong>{node?.players ?? 'Unknown'}</strong></div>
      {stale && <p role="status">Last known count; the status refresh failed.</p>}
      {!selected ? <p>Select a map to load its connected-user list.</p>
        : roster.loading && !roster.data ? <p role="status">Loading connected users...</p>
        : <>
            {failure && <p role="status">{failure}. User details may be unavailable or stale.</p>}
            {sample && <p role="status">Sample roster, not live connections.</p>}
            {instances > 1 && <p>Names are map-wide across {instances} instances; this count belongs to the selected instance.</p>}
            {roster.data && <ul>{users.map(player => <li key={player.id}>{player.name}</li>)}</ul>}
            {roster.data && !users.length && <p>{node?.players === '0' && !failure ? 'No connected users reported.' : 'No matching online names returned. The server count and roster may update at different times.'}</p>}
            <button type="button" className="spatial-secondary" disabled={roster.loading} onClick={() => { void roster.refresh() }}>Refresh users</button>
          </>}
    </section>
    <section aria-label="Map heartbeat">
      <div className="spatial-detail-title"><h3>Heartbeat</h3><span>Not reported</span></div>
      <p>The current status API does not expose a per-map heartbeat.</p>
      <p>Last status observation: <time>{observedAt}</time></p>
    </section>
  </div>
}
