'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ImproveStrategyId = 'concise' | 'detailed' | 'restructure' | 'custom'

export interface ImproveStrategyChoice {
  id: ImproveStrategyId
  customInstruction?: string
}

export const IMPROVE_STRATEGY_TEMPLATES: Record<ImproveStrategyId, string> = {
  concise: 'Rewrite the prompt to be concise and direct while preserving all key intent and constraints.',
  detailed: 'Rewrite the prompt to be explicit and detailed, clarifying goals, constraints, and expected output.',
  restructure: 'Restructure the prompt into a clear sequence: context, requirements, constraints, and desired output.',
  custom: '',
}

const PRESET_STRATEGIES: Array<{
  id: Exclude<ImproveStrategyId, 'custom'>
  label: string
  description: string
}> = [
  {
    id: 'concise',
    label: 'Concise',
    description: 'Trim verbosity, keep essentials.',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    description: 'Expand context, constraints, and expected output.',
  },
  {
    id: 'restructure',
    label: 'Restructure',
    description: 'Reorganize into clearer sections and flow.',
  },
]

export function StrategyPicker({
  disabled,
  loading,
  onSelect,
}: {
  disabled: boolean
  loading: boolean
  onSelect: (strategy: ImproveStrategyChoice) => void
}) {
  const [open, setOpen] = useState(false)
  const [customInstruction, setCustomInstruction] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const unavailable = disabled || loading

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [open])

  useEffect(() => {
    if (unavailable) {
      setOpen(false)
    }
  }, [unavailable])

  const handlePresetSelect = useCallback((id: Exclude<ImproveStrategyId, 'custom'>) => {
    onSelect({ id })
    setOpen(false)
  }, [onSelect])

  const handleCustomSelect = useCallback(() => {
    const trimmed = customInstruction.trim()
    if (!trimmed) return
    onSelect({ id: 'custom', customInstruction: trimmed })
    setCustomInstruction('')
    setOpen(false)
  }, [customInstruction, onSelect])

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        disabled={unavailable}
        title={disabled ? 'Text too short (<20 chars)' : 'Improve prompt with strategy'}
        aria-label="Choose improve strategy"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'p-1.5 rounded transition-colors',
          unavailable
            ? 'opacity-40 cursor-not-allowed text-muted-foreground'
            : 'hover:bg-accent text-muted-foreground hover:text-purple-400'
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </button>

      {open && !unavailable && (
        <div
          role="dialog"
          className="absolute right-0 top-full mt-1 z-40 w-72 rounded-md border border-border bg-popover p-2 shadow-lg"
        >
          <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Improve strategy</p>

          <div className="space-y-1">
            {PRESET_STRATEGIES.map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => handlePresetSelect(strategy.id)}
                className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
              >
                <p className="text-xs font-medium text-foreground">{strategy.label}</p>
                <p className="text-[11px] text-muted-foreground">{strategy.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">Custom</p>
            <textarea
              value={customInstruction}
              onChange={(event) => setCustomInstruction(event.target.value)}
              rows={3}
              placeholder="Add custom instruction..."
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleCustomSelect}
              disabled={!customInstruction.trim()}
              className={cn(
                'mt-2 w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                customInstruction.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'cursor-not-allowed bg-muted text-muted-foreground'
              )}
            >
              Run custom strategy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
