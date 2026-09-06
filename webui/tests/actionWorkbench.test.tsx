import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionWorkbench } from '../src/components/platform/ActionWorkbench'

const longLabel = 'Inspect a player with an unusually long descriptive operational action name'
const actions = [
  { id: 'inspect', label: longLabel, icon: 'Search', group: 'A long category label that must stay readable' },
  { id: 'offline', label: 'Offline operation', icon: 'WifiOff', group: 'Maintenance', offlineOnly: true },
]
const select = vi.fn()

function Fixture({ busy = false }: { busy?: boolean }) {
  const [id, setId] = useState<string | null>(null)
  return <ActionWorkbench actions={actions} selectedId={id} onSelect={next => { select(next); setId(next) }}
    title="Player tasks" target="Aster" busy={busy}
    renderAction={action => <label>{action.label}<input aria-label="Task draft" defaultValue="" /></label>} />
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('mobile action selection', () => {
  it('preserves the selected editor at zero matches and exposes filter recovery outside the desktop rail', () => {
    render(<Fixture />)
    const picker = screen.getByRole('combobox', { name: 'Choose a task' })
    fireEvent.change(picker, { target: { value: 'inspect' } })
    const draft = screen.getByRole('textbox', { name: 'Task draft' })
    fireEvent.change(draft, { target: { value: 'unfinished work' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no matching task' } })
    expect(within(picker).getByRole('option', { name: `${longLabel} (current)` })).toBeInTheDocument()
    const recovery = screen.getByRole('button', { name: 'Clear filters' })
    expect(recovery.closest('nav')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('No matching actions.')
    fireEvent.click(recovery)
    expect(screen.getByRole('textbox', { name: 'Task draft' })).toBe(draft)
    expect(draft).toHaveValue('unfinished work')
    expect(picker).toHaveValue('inspect')
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(select).toHaveBeenCalledExactlyOnceWith('inspect')
    expect(within(picker).getByRole('option', { name: /Offline operation - Offline required/ })).toBeInTheDocument()
  })

  it('locks both selectors while a task is busy without discarding its draft', () => {
    const view = render(<Fixture />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose a task' }), { target: { value: 'inspect' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Task draft' }), { target: { value: 'preserved' } })
    view.rerender(<Fixture busy />)
    expect(screen.getByRole('combobox', { name: 'Choose a task' })).toBeDisabled()
    for (const button of within(screen.getByRole('navigation')).getAllByRole('button')) expect(button).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Task draft' })).toHaveValue('preserved')
  })
})
