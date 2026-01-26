import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, Root } from 'react-dom/client'
import { Editor } from '../Editor'

describe('Editor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
  })

  it('renders the editor container', async () => {
    root.render(<Editor />)

    // Wait for effects to run
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Check that a CodeMirror container was created
    const cmContent = container.querySelector('.cm-editor')
    expect(cmContent).toBeTruthy()
  })

  it('initializes with provided initial value', async () => {
    const initialText = '# Hello World'
    root.render(<Editor initialValue={initialText} />)

    // Wait for effects to run
    await new Promise((resolve) => setTimeout(resolve, 100))

    const cmContent = container.querySelector('.cm-content')
    expect(cmContent?.textContent).toContain('Hello World')
  })

  it('mounts the editor when given an onChange handler', async () => {
    const onChange = vi.fn()
    root.render(<Editor onChange={onChange} />)

    // Wait for effects to run
    await new Promise((resolve) => setTimeout(resolve, 100))

    // The editor should be mounted
    const cmEditor = container.querySelector('.cm-editor')
    expect(cmEditor).toBeTruthy()
  })
})
