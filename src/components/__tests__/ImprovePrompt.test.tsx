import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImprovePromptDiffReview } from '../ImprovePrompt'

vi.mock('@/components/editor/InlineDiffView', () => ({
  InlineDiffView: ({
    original,
    modified,
    originalLabel,
    modifiedLabel,
    restoreLabel,
  }: {
    original: string
    modified: string
    originalLabel: string
    modifiedLabel: string
    restoreLabel?: string
  }) => (
    <div data-testid="inline-diff-view">
      <span>{`${originalLabel}:${original}`}</span>
      <span>{`${modifiedLabel}:${modified}`}</span>
      <button>{restoreLabel ?? 'Restore'}</button>
    </div>
  ),
}))

describe('ImprovePromptDiffReview', () => {
  it('renders inline diff review in review status', () => {
    render(
      <ImprovePromptDiffReview
        status="review"
        original="old prompt"
        improved="new prompt"
        error=""
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(screen.getByTestId('inline-diff-view')).toBeTruthy()
    expect(screen.getByText('Current:old prompt')).toBeTruthy()
    expect(screen.getByText('Improved:new prompt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
  })

  it('renders error state with dismiss action', () => {
    render(
      <ImprovePromptDiffReview
        status="error"
        original=""
        improved=""
        error="bad request"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(screen.getByText('Error')).toBeTruthy()
    expect(screen.getByText('bad request')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })

  it('renders nothing when status is idle', () => {
    const { container } = render(
      <ImprovePromptDiffReview
        status="idle"
        original=""
        improved=""
        error=""
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
