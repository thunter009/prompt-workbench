import { describe, it, expect } from 'vitest'
import {
  validateSnippet,
  validateSnippets,
  RAYCAST_CHAR_LIMIT,
} from '../validation'
import type { Snippet } from '@/types'

function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
  return {
    id: '1',
    name: 'Test Snippet',
    text: 'Hello world',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...overrides,
  }
}

describe('validateSnippet', () => {
  it('returns no issues for valid snippet with keyword', () => {
    const snippet = makeSnippet({ keyword: 'hello' })
    const issues = validateSnippet(snippet)
    expect(issues).toHaveLength(0)
  })

  it('returns warning for missing keyword', () => {
    const snippet = makeSnippet()
    const issues = validateSnippet(snippet)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].field).toBe('keyword')
  })

  it('returns error for missing name', () => {
    const snippet = makeSnippet({ name: '' })
    const issues = validateSnippet(snippet)
    const nameError = issues.find((i) => i.field === 'name')
    expect(nameError).toBeDefined()
    expect(nameError?.severity).toBe('error')
  })

  it('returns error for missing text', () => {
    const snippet = makeSnippet({ text: '' })
    const issues = validateSnippet(snippet)
    const textError = issues.find((i) => i.field === 'text')
    expect(textError).toBeDefined()
    expect(textError?.severity).toBe('error')
  })

  it('returns error for text exceeding char limit', () => {
    const longText = 'a'.repeat(RAYCAST_CHAR_LIMIT + 1)
    const snippet = makeSnippet({ text: longText, keyword: 'test' })
    const issues = validateSnippet(snippet)
    const textError = issues.find(
      (i) => i.field === 'text' && i.severity === 'error'
    )
    expect(textError).toBeDefined()
    expect(textError?.message).toContain('exceeds')
  })

  it('accepts text at exactly char limit', () => {
    const exactText = 'a'.repeat(RAYCAST_CHAR_LIMIT)
    const snippet = makeSnippet({ text: exactText, keyword: 'test' })
    const issues = validateSnippet(snippet)
    expect(issues).toHaveLength(0)
  })
})

describe('validateSnippets', () => {
  it('returns valid=true when no errors', () => {
    const snippets = [makeSnippet({ keyword: 'test' })]
    const result = validateSnippets(snippets)
    expect(result.valid).toBe(true)
    expect(result.errorCount).toBe(0)
  })

  it('returns valid=false when errors exist', () => {
    const snippets = [makeSnippet({ name: '' })]
    const result = validateSnippets(snippets)
    expect(result.valid).toBe(false)
    expect(result.errorCount).toBeGreaterThan(0)
  })

  it('aggregates issues from multiple snippets', () => {
    const snippets = [
      makeSnippet({ id: '1' }), // warning: no keyword
      makeSnippet({ id: '2', name: '' }), // error: no name + warning: no keyword
    ]
    const result = validateSnippets(snippets)
    expect(result.warningCount).toBe(2)
    expect(result.errorCount).toBe(1)
  })

  it('valid=true with only warnings', () => {
    const snippets = [
      makeSnippet({ id: '1' }), // warning only
      makeSnippet({ id: '2' }), // warning only
    ]
    const result = validateSnippets(snippets)
    expect(result.valid).toBe(true) // warnings don't block
    expect(result.warningCount).toBe(2)
  })
})
