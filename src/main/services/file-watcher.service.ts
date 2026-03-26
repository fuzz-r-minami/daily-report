import { glob } from 'glob'
import fs from 'fs'
import path from 'path'
import type { FilePathConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import { FILE_MAX_ENTRIES } from '@shared/constants'

export async function fetchChangedFiles(
  filePathConfigs: FilePathConfig[],
  dateRange: DateRange
): Promise<NonNullable<CollectedData['files']>> {
  const startDate = new Date(dateRange.start)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(dateRange.end)
  endDate.setHours(23, 59, 59, 999)

  const changedFiles: NonNullable<CollectedData['files']>['changedFiles'] = []

  for (const config of filePathConfigs) {
    if (!fs.existsSync(config.path)) continue

    const pattern = config.recursive ? '**/*' : '*'
    const files = await glob(pattern, {
      cwd: config.path,
      ignore: config.excludePatterns.length > 0 ? config.excludePatterns : undefined,
      nodir: true,
      absolute: false
    })

    for (const file of files) {
      if (changedFiles.length >= FILE_MAX_ENTRIES) break

      try {
        const fullPath = path.join(config.path, file)
        const stat = fs.statSync(fullPath)

        if (stat.mtime >= startDate && stat.mtime <= endDate) {
          changedFiles.push({
            path: path.join(config.path, file).replace(/\\/g, '/'),
            modifiedAt: stat.mtime.toISOString(),
            changeType: 'modified',
            sizeBytes: stat.size
          })
        }
      } catch {
        // skip inaccessible files
      }
    }
  }

  changedFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

  return { changedFiles, fetchedAt: new Date().toISOString() }
}
