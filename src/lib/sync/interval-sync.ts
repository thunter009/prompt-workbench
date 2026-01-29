import { schedule, ScheduledTask, validate } from 'node-cron'

export type SyncInterval = '5m' | '15m' | '30m' | '1h' | '4h'

export const SYNC_INTERVALS: { value: SyncInterval; label: string; cron: string }[] = [
  { value: '5m', label: '5 minutes', cron: '*/5 * * * *' },
  { value: '15m', label: '15 minutes', cron: '*/15 * * * *' },
  { value: '30m', label: '30 minutes', cron: '*/30 * * * *' },
  { value: '1h', label: '1 hour', cron: '0 * * * *' },
  { value: '4h', label: '4 hours', cron: '0 */4 * * *' },
]

export const DEFAULT_INTERVAL: SyncInterval = '30m'

export type SyncCallback = () => void | Promise<void>

export class IntervalSyncScheduler {
  private task: ScheduledTask | null = null
  private callback: SyncCallback | null = null
  private currentInterval: SyncInterval = DEFAULT_INTERVAL
  private enabled = false
  private lastSyncTime: number | null = null

  start(callback: SyncCallback, interval: SyncInterval = DEFAULT_INTERVAL): void {
    this.callback = callback
    this.currentInterval = interval
    this.enabled = true
    this.scheduleTask()
  }

  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
    }
    this.enabled = false
    this.callback = null
  }

  setInterval(interval: SyncInterval): void {
    if (!SYNC_INTERVALS.some((i) => i.value === interval)) {
      throw new Error(`Invalid interval: ${interval}`)
    }
    this.currentInterval = interval
    if (this.enabled && this.callback) {
      this.scheduleTask()
    }
  }

  getInterval(): SyncInterval {
    return this.currentInterval
  }

  isRunning(): boolean {
    return this.enabled && this.task !== null
  }

  getLastSyncTime(): number | null {
    return this.lastSyncTime
  }

  triggerNow(): void {
    if (this.callback) {
      this.executeSync()
    }
  }

  private scheduleTask(): void {
    // Stop existing task
    if (this.task) {
      this.task.stop()
      this.task = null
    }

    const config = SYNC_INTERVALS.find((i) => i.value === this.currentInterval)
    if (!config) return

    if (!validate(config.cron)) {
      console.error(`[IntervalSync] Invalid cron expression: ${config.cron}`)
      return
    }

    this.task = schedule(config.cron, () => {
      this.executeSync()
    })
  }

  private async executeSync(): Promise<void> {
    if (!this.callback) return

    try {
      await this.callback()
      this.lastSyncTime = Date.now()
    } catch (error) {
      console.error('[IntervalSync] Sync failed:', error)
    }
  }
}

// Singleton instance
let schedulerInstance: IntervalSyncScheduler | null = null

export function getIntervalScheduler(): IntervalSyncScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new IntervalSyncScheduler()
  }
  return schedulerInstance
}

export function resetIntervalScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop()
    schedulerInstance = null
  }
}
