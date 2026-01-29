// Server-side only (Node.js APIs) - import directly from ./file-watcher
export {
  RaycastFileWatcher,
  getFileWatcher,
  resetFileWatcher,
  type FileChangeType,
  type FileChangeEvent,
  type FileChangeCallback,
} from './file-watcher'

// Note: For client-side, import conflict-detection directly:
// import { detectConflicts } from '@/lib/sync/conflict-detection'
