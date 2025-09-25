import { pool } from '../nis.mysql'
import {
  INCOMPLETE_SUBSCRIBER_DATA_METRICS_FILE,
  INCOMPLETE_SUBSCRIBER_DATA_METRICS_FILE_TEMP,
} from '../config'
import { writeMetricsFile } from '../metrics'

export async function exportIncompleteSubscriberDataMetrics() {
  const metricName = 'incomplete_subscriber_data'
  const metricLines: string[] = []
  const sql = [
    'SELECT cs.CustServId csid, cs.CustStatus status,',
    's.ServiceType service, cs.GooglePaymentTermPlan plan,',
    'cs.GoogleCustomerUID gcid, cs.ProvisioningId pvid',
    'FROM CustomerServices cs',
    'LEFT JOIN Services s ON s.ServiceId = cs.ServiceId',
    "WHERE s.ServiceGroup = 'GS'",
    "AND cs.CustStatus IN ('AC', 'BL')",
    'AND (cs.GoogleCustomerUID IS NULL OR cs.ProvisioningId IS NULL)',
  ].join(' ')
  const [rows] = (await pool.execute(sql)) as any[]
  for (const { csid, status, service, plan, gcid, pvid } of rows) {
    const metricLabelString = [
      `csid="${csid}"`,
      `status="${status}"`,
      `service="${service}"`,
      `plan="${plan || 'none'}"`,
      `gcid="${gcid || 'none'}"`,
      `pvid="${pvid || 'none'}"`,
    ].join(',')
    metricLines.push(`${metricName}{${metricLabelString}} 1`)
  }

  await writeMetricsFile(
    metricLines,
    INCOMPLETE_SUBSCRIBER_DATA_METRICS_FILE,
    INCOMPLETE_SUBSCRIBER_DATA_METRICS_FILE_TEMP,
  )
}
