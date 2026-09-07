import { BasesTab } from '../gameplay/BasesTab'
import { BlueprintsTab } from '../gameplay/BlueprintsTab'
import { SharedInventoryExplorer } from '../../components/inventory/SharedInventoryExplorer'
import { WorkspaceLayout, type WorkspaceTab } from '../../components/platform/WorkspaceLayout'
import { getWorkspace } from '../../platform/workspaces'
import { useSearch } from '../../router'

type BasesView = 'bases' | 'blueprints' | 'inventory'

const TABS: readonly WorkspaceTab[] = [
  { id: 'bases', label: 'Bases', to: '/bases?view=bases', icon: 'Castle' },
  { id: 'blueprints', label: 'Blueprints', to: '/bases?view=blueprints', icon: 'ScrollText' },
  { id: 'inventory', label: 'Storage inventory', to: '/bases?view=inventory', icon: 'PackageSearch' },
]

function currentView(search: string): BasesView {
  const view = new URLSearchParams(search).get('view')
  if (view === 'blueprints' || view === 'inventory') return view
  return 'bases'
}

export default function BasesWorkspace() {
  const view = currentView(useSearch())
  return (
    <WorkspaceLayout workspace={getWorkspace('bases')} tabs={TABS} activeTab={view}>
      {view === 'bases' && <BasesTab />}
      {view === 'blueprints' && <BlueprintsTab />}
      {view === 'inventory' && (
        <SharedInventoryExplorer
          entityTypes={['storage']}
          description="Search proven storage-container contents. Base-wide membership is not inferred in this slice."
        />
      )}
    </WorkspaceLayout>
  )
}
