'use client'

/**
 * Skeleton placeholder shown while react-markdown Preview loads.
 * Mimics the preview layout with animated pulse effect.
 */
export function PreviewSkeleton() {
  return (
    <div className="h-full flex flex-col bg-zinc-900 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="h-3 w-14 bg-zinc-800 rounded" />
        <div className="flex items-center gap-1">
          <div className="w-7 h-7 bg-zinc-800 rounded" />
          <div className="w-7 h-7 bg-zinc-800 rounded" />
        </div>
      </div>
      {/* Content area */}
      <div className="flex-1 p-4 space-y-3">
        {/* Heading */}
        <div className="h-7 bg-zinc-800 rounded w-2/3" style={{ opacity: 0.5 }} />
        {/* Paragraphs */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-zinc-800 rounded"
            style={{ width: `${Math.random() * 40 + 50}%`, opacity: 0.4 }}
          />
        ))}
        {/* Code block */}
        <div className="h-20 bg-zinc-950 rounded mt-4" style={{ opacity: 0.5 }} />
        {/* More paragraphs */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`p2-${i}`}
            className="h-4 bg-zinc-800 rounded"
            style={{ width: `${Math.random() * 40 + 40}%`, opacity: 0.4 }}
          />
        ))}
      </div>
    </div>
  )
}
