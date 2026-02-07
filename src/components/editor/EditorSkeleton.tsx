'use client'

/**
 * Skeleton placeholder shown while CodeMirror editor loads.
 * Mimics the editor layout with animated pulse effect.
 */
export function EditorSkeleton() {
  return (
    <div className="h-full bg-background animate-pulse">
      {/* Fake gutter + content area */}
      <div className="flex h-full">
        {/* Line numbers gutter */}
        <div className="w-12 border-r border-border pt-4 px-2 space-y-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-5 bg-accent rounded"
              style={{ width: `${Math.random() * 30 + 10}px`, opacity: 0.5 }}
            />
          ))}
        </div>
        {/* Content area */}
        <div className="flex-1 pt-4 px-4 space-y-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-5 bg-accent rounded"
              style={{ width: `${Math.random() * 60 + 20}%`, opacity: 0.4 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
