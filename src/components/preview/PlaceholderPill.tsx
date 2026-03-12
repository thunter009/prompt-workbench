'use client'

import { cn } from '@/lib/utils'
import {
  ParsedPlaceholder,
  PlaceholderType,
  getPlaceholderLabel,
  getPlaceholderDescription,
  getPlaceholderPreviewValue,
} from '@/lib/raycast/placeholder-parser'
import { useSnippetStore } from '@/lib/store'

export interface PlaceholderPillProps {
  placeholder: ParsedPlaceholder
  className?: string
}

// Color scheme per placeholder type
const TYPE_COLORS: Record<PlaceholderType, { bg: string; text: string; border: string }> = {
  clipboard: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  cursor: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  date: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  time: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  datetime: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  day: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  uuid: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  selection: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  argument: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  snippet: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
}

// Icons for each type (simple unicode)
const TYPE_ICONS: Record<PlaceholderType, string> = {
  clipboard: '📋',
  cursor: '▎',
  date: '📅',
  time: '🕐',
  datetime: '📆',
  day: '📆',
  uuid: '#',
  selection: '✂',
  argument: '⌨',
  snippet: '📎',
}

export function PlaceholderPill({ placeholder, className }: PlaceholderPillProps) {
  const { type, snippetRef, argumentName, modifiers } = placeholder
  const previewValues = useSnippetStore((s) => s.previewValues)
  const colors = TYPE_COLORS[type]
  const icon = TYPE_ICONS[type]

  // If preview values mode is on, show the example value inline
  if (previewValues) {
    const previewValue = getPlaceholderPreviewValue(placeholder)
    return (
      <span
        className={cn(
          'inline px-0.5 rounded text-foreground bg-accent/50',
          className
        )}
        title={`${placeholder.raw} → ${previewValue}`}
      >
        {previewValue}
      </span>
    )
  }

  // Display label: type name, or specific name for snippets/arguments
  let displayLabel = getPlaceholderLabel(type)
  if (type === 'snippet' && snippetRef) {
    displayLabel = snippetRef
  } else if (type === 'argument' && argumentName) {
    displayLabel = argumentName
  }

  const description = getPlaceholderDescription(placeholder)

  return (
    <span className={cn('group relative inline-flex', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium',
          'border transition-colors cursor-default',
          colors.bg,
          colors.text,
          colors.border,
          'hover:brightness-110'
        )}
      >
        <span className="text-[10px] opacity-70">{icon}</span>
        <span>{displayLabel}</span>
        {modifiers.length > 0 && (
          <span className="opacity-60 text-[10px]">
            ({modifiers.length})
          </span>
        )}
      </span>

      {/* Tooltip */}
      <span
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5',
          'px-2 py-1.5 rounded-md text-xs whitespace-nowrap',
          'bg-accent text-foreground border border-border',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
          'transition-opacity duration-150 z-50 shadow-lg'
        )}
      >
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-accent" />

        {/* Content */}
        <span className="flex flex-col gap-0.5">
          <code className="text-[10px] text-muted-foreground font-mono">{placeholder.raw}</code>
          <span className="text-secondary-foreground">{description}</span>
        </span>
      </span>
    </span>
  )
}
