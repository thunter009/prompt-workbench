'use client'

import dynamic from 'next/dynamic'
import { PreviewSkeleton } from './PreviewSkeleton'

const previewLoader = () => import('./Preview').then((mod) => mod.Preview)

/**
 * Dynamically imported react-markdown Preview.
 * Reduces initial bundle by ~50KB+ by lazy-loading react-markdown deps.
 */
export const PreviewDynamic = dynamic(previewLoader, {
  loading: () => <PreviewSkeleton />,
  ssr: false,
})

/** Preload preview chunk on hover to reduce perceived latency */
export const preloadPreview = () => {
  void previewLoader()
}

export type { PreviewProps } from './Preview'
