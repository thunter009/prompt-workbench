'use client'

import dynamic from 'next/dynamic'
import { PreviewSkeleton } from './PreviewSkeleton'

/**
 * Dynamically imported react-markdown Preview.
 * Reduces initial bundle by ~50KB+ by lazy-loading react-markdown deps.
 */
export const PreviewDynamic = dynamic(
  () => import('./Preview').then((mod) => mod.Preview),
  {
    loading: () => <PreviewSkeleton />,
    ssr: false,
  }
)

export type { PreviewProps } from './Preview'
