// Server-side only (Node.js APIs) - import directly from ./file-watcher
export {
  RaycastFileWatcher,
  getFileWatcher,
  resetFileWatcher,
  type FileChangeType,
  type FileChangeEvent,
  type FileChangeCallback,
} from './file-watcher'

export {
  IntervalSyncScheduler,
  getIntervalScheduler,
  resetIntervalScheduler,
  SYNC_INTERVALS,
  DEFAULT_INTERVAL,
  type SyncInterval,
  type SyncCallback,
} from './interval-sync'

// Note: For client-side, import conflict-detection directly:
// import { detectConflicts } from '@/lib/sync/conflict-detection'
