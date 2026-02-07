'use client'

import { useCallback, useEffect, useRef } from 'react'

interface ResizableDividerProps {
  onResize: (leftWidthPercent: number) => void
  minLeftPx?: number
  minRightPx?: number
}

export function ResizableDivider({
  onResize,
  minLeftPx = 200,
  minRightPx = 200,
}: ResizableDividerProps) {
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return

      const container = containerRef.current?.parentElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      const containerWidth = rect.width
      const mouseX = e.clientX - rect.left

      // Enforce min widths
      const clampedX = Math.max(minLeftPx, Math.min(mouseX, containerWidth - minRightPx))
      const percent = (clampedX / containerWidth) * 100

      onResize(percent)
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize, minLeftPx, minRightPx])

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className="w-1 bg-accent hover:bg-accent-foreground/10 cursor-col-resize transition-colors flex-shrink-0"
    />
  )
}
