import { describe, expect, it } from 'vitest'
import { createLLMAdapter } from '../index'

describe('createLLMAdapter', () => {
  it('creates ollama adapter by default config', () => {
    const adapter = createLLMAdapter({ provider: 'ollama' })
    expect(adapter.constructor.name).toBe('OllamaAdapter')
  })

  it('requires API key for OpenAI provider', () => {
    expect(() => createLLMAdapter({ provider: 'openai' })).toThrow('OpenAI API key required')
  })

  it('creates OpenAI adapter when API key is provided', () => {
    const adapter = createLLMAdapter({ provider: 'openai', openaiApiKey: 'sk-test' })
    expect(adapter.constructor.name).toBe('OpenAIAdapter')
  })

  it('requires API key for Anthropic provider', () => {
    expect(() => createLLMAdapter({ provider: 'anthropic' })).toThrow('Anthropic API key required')
  })

  it('creates Anthropic adapter when API key is provided', () => {
    const adapter = createLLMAdapter({ provider: 'anthropic', anthropicApiKey: 'sk-ant-test' })
    expect(adapter.constructor.name).toBe('AnthropicAdapter')
  })
})
