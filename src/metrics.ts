import fs from 'fs/promises'
import path from 'path'
import logger from './logger'

export async function writeMetricsFile(
  metricLines: string[],
  fileName: string,
  fileNameTemp: string,
) {
  try {
    const dir = path.dirname(fileNameTemp)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fileNameTemp, metricLines.join('\n') + '\n')
    await fs.rename(fileNameTemp, fileName)
  } catch (err) {
    logger.error('Error writing metrics to file:', err)
  }
}
