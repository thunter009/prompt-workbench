import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StrategyPicker } from '../StrategyPicker'

describe('StrategyPicker', () => {
  it('opens strategy menu and selects a preset strategy', () => {
    const onSelect = vi.fn()

    render(<StrategyPicker disabled={false} loading={false} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose improve strategy' }))
    fireEvent.click(screen.getByText('Concise').closest('button') as HTMLButtonElement)

    expect(onSelect).toHaveBeenCalledWith({ id: 'concise' })
  })

  it('submits trimmed custom instruction strategy', () => {
    const onSelect = vi.fn()

    render(<StrategyPicker disabled={false} loading={false} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose improve strategy' }))
    fireEvent.change(screen.getByPlaceholderText('Add custom instruction...'), {
      target: { value: '  preserve placeholders exactly  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run custom strategy' }))

    expect(onSelect).toHaveBeenCalledWith({
      id: 'custom',
      customInstruction: 'preserve placeholders exactly',
    })
  })

  it('does not open menu while loading', () => {
    render(<StrategyPicker disabled={false} loading onSelect={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose improve strategy' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
