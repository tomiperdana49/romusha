import { pool } from '../nis.mysql'
import {
  ISSUE_GRACE_PERIOD_SECONDS,
  ISSUE_METRICS_FILE,
  ISSUE_METRICS_FILE_TEMP,
} from '../config'
import { writeMetricsFile } from '../metrics'

export async function getOutdatedIssue() {
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const timeThreshold = currentTimestamp - ISSUE_GRACE_PERIOD_SECONDS
  try {
    const issueMap: any = {}
    const issueIds = []

    const issueSql = [
      'SELECT id, subject, status FROM noc',
      'WHERE UNIX_TIMESTAMP(datetime) < ?',
      'AND NOT(status IN (?, ?, ?, ?))',
    ].join(' ')
    const [issueRows] = await pool.query(issueSql, [
      timeThreshold,
      '',
      'Close',
      'Cancel',
      'Scheduled',
    ])

    for (const { id, subject, status } of issueRows as any[]) {
      issueMap[id] = { subject, status, outdated: true }
      issueIds.push(id)
    }

    if (issueIds.length == 0) {
      return []
    }

    const issueIdsHolder = issueIds.map(() => '?').join(', ')
    const issueUpdateSql = [
      'SELECT COUNT(id) AS num, noc_id AS id FROM noc_update',
      `WHERE noc_id IN (${issueIdsHolder})`,
      'AND UNIX_TIMESTAMP(datetime) > ?',
      'GROUP BY noc_id',
    ].join(' ')
    const [updateRows] = await pool.query(issueUpdateSql, [
      ...issueIds,
      timeThreshold,
    ])

    for (const { id } of updateRows as any[]) {
      issueMap[id].outdated = false
    }

    const outdatedIssues = Object.entries(issueMap)
      .filter(([_key, value]: any[]) => value.outdated)
      .map(([id, value]: any[]) => {
        const { outdated: _, ...rest } = value
        return { id, ...rest }
      })
    return outdatedIssues
  } catch {
    return []
  }
}

export async function generateOutdatedIssueMetrics() {
  const metricLabels = await getOutdatedIssue()
  const metricName = 'outdated_issue'
  const metricValue = 1
  const metricLines = metricLabels.map((e: any) => {
    const labelsParts = []
    for (const key in e) {
      labelsParts.push(`${key}="${e[key]}"`)
    }
    return `${metricName}{${labelsParts.join(',')}} ${metricValue}`
  })
  writeMetricsFile(metricLines, ISSUE_METRICS_FILE, ISSUE_METRICS_FILE_TEMP)
}
