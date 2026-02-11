'use client'

import { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePlaygroundStore } from '@/lib/playground-store'
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
  h4: ({ children }) => (
    <h4 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h4>
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
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
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
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border border-border rounded">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-accent">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr className="divide-x divide-border">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-secondary-foreground">{children}</td>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-secondary-foreground">{children}</em>,
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ResponseViewer() {
  const isRunning = usePlaygroundStore((s) => s.isRunning)
  const currentResponse = usePlaygroundStore((s) => s.currentResponse)
  const responseMeta = usePlaygroundStore((s) => s.responseMeta)
  const clearResponse = usePlaygroundStore((s) => s.clearResponse)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(currentResponse)
    toast.success('Copied to clipboard')
  }, [currentResponse])

  if (!currentResponse && !isRunning) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Response
        </h3>
        <div className="flex items-center gap-1">
          {currentResponse && (
            <button
              onClick={handleCopy}
              className="p-1 rounded text-muted-foreground hover:text-secondary-foreground hover:bg-accent transition-colors"
              title="Copy response"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {currentResponse && !isRunning && (
            <button
              onClick={clearResponse}
              className="p-1 rounded text-muted-foreground hover:text-secondary-foreground hover:bg-accent transition-colors"
              title="Clear response"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 bg-background border border-border rounded overflow-auto">
        {isRunning && !currentResponse && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for response...
          </div>
        )}
        {currentResponse && (
          <div className="prose prose-invert max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {currentResponse}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {responseMeta && !isRunning && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{responseMeta.model}</span>
          {responseMeta.tokenCount > 0 && (
            <span>{responseMeta.tokenCount} tokens</span>
          )}
          <span>{formatElapsed(responseMeta.elapsedMs)}</span>
        </div>
      )}
    </div>
  )
}
