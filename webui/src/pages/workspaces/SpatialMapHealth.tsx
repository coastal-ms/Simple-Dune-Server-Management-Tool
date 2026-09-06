import type { SpatialNode } from './spatialModel'

export default function SpatialMapHealth({ nodes, selected, onSelect, observedAt, stale }: {
  nodes: SpatialNode[]
  selected: string
  onSelect: (id: string) => void
  observedAt: string
  stale: boolean
}) {
  return <section className="spatial-map-health" aria-labelledby="spatial-map-health-title">
    <header>
      <div><h2 id="spatial-map-health-title">Map health</h2><p>Reported instances, including starting and non-ready maps.</p></div>
      <span>{nodes.length} instance{nodes.length === 1 ? '' : 's'}</span>
    </header>
    {stale && <p className="spatial-health-stale" role="status">Status refresh failed. These are last known observations.</p>}
    {nodes.length === 0 ? <p>No map instances reported.</p> : <ul aria-label="Map health list">
      {nodes.map(node => <li key={node.id} data-selected={selected === node.id}>
        <button type="button" aria-label={`Inspect health for ${node.title}`} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}>
          <i aria-hidden="true" data-ready={node.ready} /><strong>{node.title}</strong>
        </button>
        <dl>
          <div><dt>Phase</dt><dd>{node.phase}</dd></div>
          <div><dt>Readiness</dt><dd data-ready={node.ready}>{node.ready}</dd></div>
          <div><dt>Players</dt><dd>{node.players}</dd></div>
          <div><dt>Server age</dt><dd>{node.age || 'Unknown'}</dd></div>
        </dl>
      </li>)}
    </ul>}
    <footer>Observed <time>{observedAt}</time>. Readiness and age are not a per-map heartbeat.</footer>
  </section>
}
