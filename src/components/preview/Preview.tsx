'use client'

export interface PreviewProps {
  content: string
}

export function Preview({ content }: PreviewProps) {
  return (
    <div className="h-full overflow-auto bg-zinc-900 p-4">
      <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300">
        {content || 'Start typing to see preview...'}
      </pre>
    </div>
  )
}
