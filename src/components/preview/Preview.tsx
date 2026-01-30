'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Eye, EyeOff, Link, Unlink } from 'lucide-react'
import { remarkRaycastPlaceholders } from '@/lib/remark-raycast-placeholders'
import { PlaceholderPill } from './PlaceholderPill'
import { useSnippetStore } from '@/lib/store'
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
    <h1 className="text-2xl font-bold mt-6 mb-4 text-zinc-100 border-b border-zinc-700 pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-3 text-zinc-100 border-b border-zinc-800 pb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-zinc-100">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold mt-3 mb-2 text-zinc-200">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-semibold mt-3 mb-1 text-zinc-200">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-sm font-medium mt-2 mb-1 text-zinc-300">{children}</h6>
  ),
  // Paragraphs
  p: ({ children }) => (
    <p className="my-2 text-zinc-300 leading-relaxed">{children}</p>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc list-outside text-zinc-300 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal list-outside text-zinc-300 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-zinc-300">{children}</li>
  ),
  // Code
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block bg-zinc-950 text-zinc-300 rounded p-3 my-2 overflow-x-auto text-sm font-mono">
          {children}
        </code>
      )
    }
    return (
      <code className="bg-zinc-800 text-violet-400 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="bg-zinc-950 rounded-lg my-3 overflow-hidden">{children}</pre>
  ),
  // Links
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
  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-zinc-600 pl-4 my-3 text-zinc-400 italic">
      {children}
    </blockquote>
  ),
  // Horizontal rules
  hr: () => <hr className="my-6 border-zinc-700" />,
  // Tables (GFM)
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border border-zinc-700 rounded">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-800">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-zinc-700">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="divide-x divide-zinc-700">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-zinc-300">{children}</td>
  ),
  // Strikethrough (GFM)
  del: ({ children }) => (
    <del className="text-zinc-500 line-through">{children}</del>
  ),
  // Strong/emphasis
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-zinc-300">{children}</em>
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

export function Preview({ content, scrollProgress }: PreviewProps) {
  const [debouncedContent, setDebouncedContent] = useState(content)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const previewValues = useSnippetStore((s) => s.previewValues)
  const togglePreviewValues = useSnippetStore((s) => s.togglePreviewValues)
  const syncScroll = useSnippetStore((s) => s.syncScroll)
  const toggleSyncScroll = useSnippetStore((s) => s.toggleSyncScroll)

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

  if (!debouncedContent) {
    return (
      <div className="h-full flex flex-col bg-zinc-900">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Preview</span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleSyncScroll}
              className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${
                syncScroll ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={syncScroll ? 'Disable scroll sync' : 'Enable scroll sync'}
            >
              {syncScroll ? <Link className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
            </button>
            <button
              onClick={togglePreviewValues}
              className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${
                previewValues ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={previewValues ? 'Hide example values' : 'Show example values'}
            >
              {previewValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-zinc-500 text-sm">Start typing to see preview...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Preview</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSyncScroll}
            className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${
              syncScroll ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={syncScroll ? 'Disable scroll sync' : 'Enable scroll sync'}
          >
            {syncScroll ? <Link className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
          </button>
          <button
            onClick={togglePreviewValues}
            className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${
              previewValues ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={previewValues ? 'Hide example values' : 'Show example values'}
          >
            {previewValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4">
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkRaycastPlaceholders]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {debouncedContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
