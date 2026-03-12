'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Eye, EyeOff, Link, Unlink, Layers, Layers2 } from 'lucide-react'
import { remarkRaycastPlaceholders } from '@/lib/remark-raycast-placeholders'
import { PlaceholderPill } from './PlaceholderPill'
import { useSnippetStore } from '@/lib/store'
import { resolveSnippetIncludes, type ResolutionError } from '@/lib/raycast/snippet-resolver'
import { findPlaceholders } from '@/lib/raycast/placeholder-parser'
import type { ParsedPlaceholder } from '@/lib/raycast/placeholder-parser'
import type { Components } from 'react-markdown'

// Extended components type to include custom raycast-placeholder element
type ExtendedComponents = Components & {
  'raycast-placeholder': (props: { raw?: string; parsed?: string }) => React.ReactNode
}

// Static markdown components hoisted to module level to avoid recreation on each render
const markdownComponents: ExtendedComponents = {
  // Headings
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
  h5: ({ children }) => (
    <h5 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-sm font-medium mt-2 mb-1 text-secondary-foreground">{children}</h6>
  ),
  // Paragraphs
  p: ({ children }) => (
    <p className="my-2 text-secondary-foreground leading-relaxed">{children}</p>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc list-outside text-secondary-foreground space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal list-outside text-secondary-foreground space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-secondary-foreground">{children}</li>
  ),
  // Code
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
  // Links
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
  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 my-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  // Horizontal rules
  hr: () => <hr className="my-6 border-border" />,
  // Tables (GFM)
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border border-border rounded">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-accent">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="divide-x divide-border">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-secondary-foreground">{children}</td>
  ),
  // Strikethrough (GFM)
  del: ({ children }) => (
    <del className="text-muted-foreground line-through">{children}</del>
  ),
  // Strong/emphasis
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-secondary-foreground">{children}</em>
  ),
  // Task lists (GFM)
  input: ({ checked, disabled }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      className="mr-2 accent-blue-500"
      readOnly
    />
  ),
  // Images - using img instead of Next Image since markdown content is arbitrary
  // eslint-disable-next-line @next/next/no-img-element
  img: (props) => <img {...props} alt={props.alt || ''} className="max-w-full h-auto rounded my-2" />,
  // Raycast placeholder pills
  'raycast-placeholder': ({ raw, parsed }: { raw?: string; parsed?: string }) => {
    if (!parsed) return <span>{raw}</span>
    try {
      const placeholderData = JSON.parse(parsed) as ParsedPlaceholder
      return <PlaceholderPill placeholder={placeholderData} />
    } catch {
      return <span>{raw}</span>
    }
  },
}

export interface PreviewProps {
  content: string
  scrollProgress?: number
}

const DEBOUNCE_MS = 100

function ErrorPill({ error }: { error: ResolutionError }) {
  const isNotFound = error.error === 'not_found'
  const label = isNotFound
    ? `not found: ${error.snippetName}`
    : error.error === 'circular'
      ? `circular: ${error.snippetName}`
      : `max depth: ${error.snippetName}`

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium border ${
        isNotFound
          ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
          : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
      }`}
    >
      <span className="text-[10px]">&#x26A0;</span>
      <span>{label}</span>
    </span>
  )
}

/** Build preview content with resolved includes shown in visual containers */
function ResolvedPreview({ content, snippets }: { content: string; snippets: { id: string; name: string; text: string }[] }) {
  const result = useMemo(() => {
    const matches = findPlaceholders(content)
    const snippetMatches = matches.filter((m) => m.placeholder.type === 'snippet' && m.placeholder.snippetRef)

    if (snippetMatches.length === 0) return { segments: [{ type: 'text' as const, content }], errors: [] }

    const { errors } = resolveSnippetIncludes(content, snippets as import('@/types').Snippet[])
    const errorsByName = new Map<string, ResolutionError>()
    for (const e of errors) errorsByName.set(e.snippetName, e)

    const segments: Array<
      | { type: 'text'; content: string }
      | { type: 'resolved'; name: string; content: string }
      | { type: 'error'; error: ResolutionError }
    > = []
    let lastEnd = 0

    for (const match of snippetMatches) {
      if (match.start > lastEnd) {
        segments.push({ type: 'text', content: content.slice(lastEnd, match.start) })
      }

      const name = match.placeholder.snippetRef!
      const err = errorsByName.get(name)
      if (err) {
        segments.push({ type: 'error', error: err })
      } else {
        const target = snippets.find((s) => s.name === name)
        if (target) {
          // Recursively resolve the target's text
          const resolved = resolveSnippetIncludes(target.text, snippets as import('@/types').Snippet[])
          segments.push({ type: 'resolved', name, content: resolved.text })
        }
      }
      lastEnd = match.end
    }

    if (lastEnd < content.length) {
      segments.push({ type: 'text', content: content.slice(lastEnd) })
    }

    return { segments, errors }
  }, [content, snippets])

  return (
    <>
      {result.segments.map((seg, i) => {
        if (seg.type === 'error') {
          return <ErrorPill key={i} error={seg.error} />
        }
        if (seg.type === 'resolved') {
          return (
            <div key={i} className="my-2 border-l-2 border-violet-500/40 pl-3 bg-violet-500/5 rounded-r py-1">
              <span className="text-[10px] font-medium text-violet-400/70 uppercase tracking-wider">
                &#x2192; {seg.name}
              </span>
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkRaycastPlaceholders]}
    
                  components={markdownComponents}
                >
                  {seg.content}
                </ReactMarkdown>
              </div>
            </div>
          )
        }
        return (
          <div key={i} className="prose dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkRaycastPlaceholders]}

              components={markdownComponents}
            >
              {seg.content}
            </ReactMarkdown>
          </div>
        )
      })}
    </>
  )
}

export function PreviewToolbar() {
  const previewValues = useSnippetStore((s) => s.previewValues)
  const togglePreviewValues = useSnippetStore((s) => s.togglePreviewValues)
  const syncScroll = useSnippetStore((s) => s.syncScroll)
  const toggleSyncScroll = useSnippetStore((s) => s.toggleSyncScroll)
  const resolveIncludes = useSnippetStore((s) => s.resolveIncludes)
  const toggleResolveIncludes = useSnippetStore((s) => s.toggleResolveIncludes)

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleResolveIncludes}
        className={`p-1.5 rounded hover:bg-accent transition-colors ${
          resolveIncludes ? 'text-violet-400' : 'text-muted-foreground hover:text-secondary-foreground'
        }`}
        title={resolveIncludes ? 'Hide resolved includes' : 'Resolve includes'}
      >
        {resolveIncludes ? <Layers className="w-4 h-4" /> : <Layers2 className="w-4 h-4" />}
      </button>
      <button
        onClick={toggleSyncScroll}
        className={`p-1.5 rounded hover:bg-accent transition-colors ${
          syncScroll ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-secondary-foreground'
        }`}
        title={syncScroll ? 'Disable scroll sync' : 'Enable scroll sync'}
      >
        {syncScroll ? <Link className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
      </button>
      <button
        onClick={togglePreviewValues}
        className={`p-1.5 rounded hover:bg-accent transition-colors ${
          previewValues ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-secondary-foreground'
        }`}
        title={previewValues ? 'Hide example values' : 'Show example values'}
      >
        {previewValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  )
}

export function Preview({ content, scrollProgress }: PreviewProps) {
  const [debouncedContent, setDebouncedContent] = useState(content)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const resolveIncludes = useSnippetStore((s) => s.resolveIncludes)
  const snippets = useSnippetStore((s) => s.snippets)

  // Debounce content updates
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setDebouncedContent(content)
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [content])

  // Sync scroll with editor
  useEffect(() => {
    if (scrollProgress === undefined || !scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const maxScroll = container.scrollHeight - container.clientHeight
    container.scrollTop = scrollProgress * maxScroll
  }, [scrollProgress])

  // Check if content has snippet includes
  const hasIncludes = useMemo(() => {
    const matches = findPlaceholders(debouncedContent)
    return matches.some((m) => m.placeholder.type === 'snippet' && m.placeholder.snippetRef)
  }, [debouncedContent])

  if (!debouncedContent) {
    return (
      <div className="h-full flex flex-col bg-muted">
        <div data-testid="empty-state" className="flex-1 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Nothing to preview</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-muted">
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4">
        {resolveIncludes && hasIncludes ? (
          <ResolvedPreview content={debouncedContent} snippets={snippets} />
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkRaycastPlaceholders]}

              components={markdownComponents}
            >
              {debouncedContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
