/**
 * System stats monitoring (#80)
 *
 * Tracks CPU, memory, and disk usage using Node.js built-in os module.
 * Updates don't need to be instant - polled periodically.
 */

import { cpus, freemem, totalmem, loadavg, uptime } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { SystemStats } from '../shared/types.js'

const execAsync = promisify(exec)

let cachedStats: SystemStats | null = null

/**
 * Get current system stats
 * Uses cached disk info (updated separately since disk checks are slower)
 */
export async function getSystemStats(): Promise<SystemStats> {
  const load = loadavg() as [number, number, number]
  const totalBytes = totalmem()
  const freeBytes = freemem()
  const usedBytes = totalBytes - freeBytes

  const stats: SystemStats = {
    cpu: {
      count: cpus().length,
      loadAvg: [
        Math.round(load[0] * 100) / 100,
        Math.round(load[1] * 100) / 100,
        Math.round(load[2] * 100) / 100,
      ],
    },
    memory: {
      totalGB: Math.round(totalBytes / (1024 ** 3) * 10) / 10,
      freeGB: Math.round(freeBytes / (1024 ** 3) * 10) / 10,
      usedPercent: Math.round((usedBytes / totalBytes) * 100),
    },
    disk: cachedStats?.disk || { totalGB: 0, freeGB: 0, usedPercent: 0 },
    uptime: Math.round(uptime()),
    timestamp: Date.now(),
  }

  return stats
}

/**
 * Update disk stats (runs df command, call less frequently)
 */
export async function updateDiskStats(): Promise<void> {
  try {
    // df for root filesystem, output in 1K blocks
    const { stdout } = await execAsync("df -k / | tail -1", { timeout: 5000 })
    const parts = stdout.trim().split(/\s+/)
    // Format: Filesystem 1K-blocks Used Available Use% Mounted
    if (parts.length >= 5) {
      const totalKB = parseInt(parts[1], 10)
      const usedKB = parseInt(parts[2], 10)
      const freeKB = parseInt(parts[3], 10)

      if (cachedStats) {
        cachedStats.disk = {
          totalGB: Math.round(totalKB / (1024 ** 2) * 10) / 10,
          freeGB: Math.round(freeKB / (1024 ** 2) * 10) / 10,
          usedPercent: Math.round((usedKB / totalKB) * 100),
        }
      } else {
        cachedStats = await getSystemStats()
        cachedStats.disk = {
          totalGB: Math.round(totalKB / (1024 ** 2) * 10) / 10,
          freeGB: Math.round(freeKB / (1024 ** 2) * 10) / 10,
          usedPercent: Math.round((usedKB / totalKB) * 100),
        }
      }
    }
  } catch {
    // df failed, keep existing disk stats
  }
}

/**
 * Start periodic disk stat updates (every 60s)
 * Call once on server startup
 */
export function startDiskMonitoring(): void {
  // Initial fetch
  updateDiskStats()
  // Update every 60 seconds
  setInterval(updateDiskStats, 60_000)
}
