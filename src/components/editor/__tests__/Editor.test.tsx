import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { Editor } from '../Editor'

afterEach(() => {
  cleanup()
})

describe('Editor', () => {
  it('renders the editor container', async () => {
    const { container } = render(<Editor />)

    await waitFor(() => {
      expect(container.querySelector('.cm-editor')).toBeTruthy()
    }, { timeout: 2000 })
  })

  it('initializes with provided value', async () => {
    const initialText = '# Hello World'
    const { container } = render(<Editor value={initialText} />)

    await waitFor(() => {
      expect(container.querySelector('.cm-content')?.textContent).toContain('Hello World')
    }, { timeout: 2000 })
  })

  it('mounts the editor when given an onChange handler', async () => {
    const onChange = vi.fn()
    const { container } = render(<Editor onChange={onChange} />)

    await waitFor(() => {
      expect(container.querySelector('.cm-editor')).toBeTruthy()
    }, { timeout: 2000 })
  })
})
