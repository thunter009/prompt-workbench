import { watch, type FSWatcher } from 'chokidar'
import { homedir } from 'os'
import { join } from 'path'

export type FileChangeType = 'add' | 'change' | 'unlink'

export interface FileChangeEvent {
  type: FileChangeType
  path: string
  timestamp: number
}

export type FileChangeCallback = (events: FileChangeEvent[]) => void

const DEFAULT_RAYCAST_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'Raycast'
)
const DEBOUNCE_MS = 1000

export class RaycastFileWatcher {
  private watcher: FSWatcher | null = null
  private pendingEvents: FileChangeEvent[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private callback: FileChangeCallback | null = null
  private watchPath: string

  constructor(customPath?: string) {
    this.watchPath = customPath || DEFAULT_RAYCAST_PATH
  }

  start(callback: FileChangeCallback): void {
    if (this.watcher) {
      return // Already watching
    }

    this.callback = callback

    this.watcher = watch(this.watchPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      // Only watch JSON files (Raycast snippets are JSON)
      ignored: (path: string) => {
        // Allow directories for traversal
        if (!path.includes('.')) return false
        // Only watch .json files
        return !path.endsWith('.json')
      },
    })

    this.watcher.on('add', (path) => this.handleEvent('add', path))
    this.watcher.on('change', (path) => this.handleEvent('change', path))
    this.watcher.on('unlink', (path) => this.handleEvent('unlink', path))
    this.watcher.on('error', (error) => {
      console.error('[FileWatcher] Error:', error)
    })
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    this.pendingEvents = []
    this.callback = null
  }

  isWatching(): boolean {
    return this.watcher !== null
  }

  getWatchPath(): string {
    return this.watchPath
  }

  private handleEvent(type: FileChangeType, path: string): void {
    this.pendingEvents.push({
      type,
      path,
      timestamp: Date.now(),
    })

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.flushEvents()
    }, DEBOUNCE_MS)
  }

  private flushEvents(): void {
    if (this.pendingEvents.length === 0 || !this.callback) {
      return
    }

    // Dedupe: if same path has multiple events, keep latest
    const eventMap = new Map<string, FileChangeEvent>()
    for (const event of this.pendingEvents) {
      eventMap.set(event.path, event)
    }

    const events = Array.from(eventMap.values())
    this.pendingEvents = []
    this.debounceTimer = null

    this.callback(events)
  }
}

// Singleton instance for app-wide use
let watcherInstance: RaycastFileWatcher | null = null

export function getFileWatcher(customPath?: string): RaycastFileWatcher {
  if (!watcherInstance) {
    watcherInstance = new RaycastFileWatcher(customPath)
  }
  return watcherInstance
}

export function resetFileWatcher(): void {
  if (watcherInstance) {
    watcherInstance.stop()
    watcherInstance = null
  }
}
