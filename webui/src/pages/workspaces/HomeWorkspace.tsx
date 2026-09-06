import { lazy, Suspense } from 'react'
import { useCommandDeck } from '../../hooks/useCommandDeck'
import { DataState } from '../../components/platform/DataState'
import { setSpatialHome, useSpatialHome } from '../../hooks/useSpatialHome'
import { Icon } from '../../components/Icon'

const Dashboard = lazy(() => import('../Dashboard').then(module => ({ default: module.Dashboard })))
const CommandDeckHome = lazy(() => import('./SpatialHome'))
const SpatialFrame = lazy(() => import('../../layout/SpatialFrame'))

export default function HomeWorkspace() {
  const commandDeck = useCommandDeck()
  const spatial = useSpatialHome()
  return (
    <Suspense fallback={<DataState state="loading" title="Loading overview..." />}>
      {commandDeck && spatial
        ? <CommandDeckHome startEnabled onDetails={() => setSpatialHome(false)} />
        : commandDeck
          ? <SpatialFrame tools>
              <nav className="spatial-home-switch" aria-label="Home view">
                <button type="button" aria-pressed="true"><Icon name="LayoutDashboard" size={16} />Dashboard</button>
                <button type="button" aria-pressed="false" onClick={() => setSpatialHome(true)}><Icon name="Globe" size={16} />Spatial view</button>
              </nav>
              <Dashboard />
            </SpatialFrame>
          : <Dashboard />}
    </Suspense>
  )
}
