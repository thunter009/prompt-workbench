'use client'

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePlaygroundStore } from '@/lib/playground-store'
import { cn } from '@/lib/utils'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground border-b border-border pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground border-b border-border pb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-2 text-secondary-foreground leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc list-outside text-secondary-foreground space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal list-outside text-secondary-foreground space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-secondary-foreground">{children}</li>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block bg-background text-secondary-foreground rounded p-3 my-2 overflow-x-auto text-sm font-mono">
          {children}
        </code>
      )
    }
    return (
      <code className="bg-accent text-violet-400 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="bg-background rounded-lg my-3 overflow-hidden">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 my-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function CompareViewer() {
  const compareResponses = usePlaygroundStore((s) => s.compareResponses)
  const compareModels = usePlaygroundStore((s) => s.compareModels)
  const isComparing = usePlaygroundStore((s) => s.isComparing)
  const clearCompareResponses = usePlaygroundStore((s) => s.clearCompareResponses)
  const [activeTab, setActiveTab] = useState(0)

  const models = compareModels.filter((m) => m in compareResponses)
  // During comparison, show all models being compared even if not yet in responses
  const displayModels = isComparing ? compareModels : models

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }, [])

  if (displayModels.length === 0 && !isComparing) return null

  const clampedTab = Math.min(activeTab, Math.max(0, displayModels.length - 1))
  const currentModel = displayModels[clampedTab]
  const currentData = currentModel ? compareResponses[currentModel] : undefined

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Comparison
        </h3>
        {!isComparing && models.length > 0 && (
          <button
            onClick={clearCompareResponses}
            className="p-1 rounded text-muted-foreground hover:text-secondary-foreground hover:bg-accent transition-colors"
            title="Clear comparison"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {displayModels.map((model, i) => {
          const data = compareResponses[model]
          return (
            <button
              key={model}
              onClick={() => setActiveTab(i)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                clampedTab === i
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-secondary-foreground',
              )}
            >
              <span className="flex items-center gap-1.5">
                {model}
                {data?.isRunning && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <div className="p-3 bg-background border border-border rounded-b overflow-auto">
        {!currentData || (currentData.isRunning && !currentData.response) ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for response...
          </div>
        ) : currentData.error ? (
          <div className="text-sm text-destructive">Error: {currentData.error}</div>
        ) : (
          <>
            <div className="flex justify-end mb-1">
              <button
                onClick={() => handleCopy(currentData.response)}
                className="p-1 rounded text-muted-foreground hover:text-secondary-foreground hover:bg-accent transition-colors"
                title="Copy response"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="prose prose-invert max-w-none text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {currentData.response}
              </ReactMarkdown>
            </div>
          </>
        )}
      </div>

      {/* Stats for current model */}
      {currentData && !currentData.isRunning && !currentData.error && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{currentData.model}</span>
          {currentData.tokenCount > 0 && (
            <span>{currentData.tokenCount} tokens</span>
          )}
          {currentData.elapsedMs > 0 && (
            <span>{formatElapsed(currentData.elapsedMs)}</span>
          )}
        </div>
      )}
    </div>
  )
}
