import IPCIDR from 'ip-cidr'
import { pool } from '../nis.mysql'
import {
  ONLINE_TICKET_METRICS_FILE,
  ONLINE_TICKET_METRICS_FILE_TEMP,
} from '../config'
import { writeMetricsFile } from '../metrics'

export async function exportOnlinePppoeTicketMetrics() {
  const gracePeriod = 1500
  const gracePeriodMargin = 600
  const metricName = 'online_pppoe_ticket'
  const now = Date.now()
  const timeFormatter = Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const timeHighThreshold = timeFormatter
    .format(new Date(now - 1000 * (gracePeriod - gracePeriodMargin)))
    .replace(',', '')
  const timeLowThreshold = timeFormatter
    .format(new Date(now - 1000 * (gracePeriod + gracePeriodMargin)))
    .replace(',', '')
  const ipMap = new Map<string, number>()
  const csTicketMap = new Map<number, number>()
  const ips: string[] = []
  const metricLines: string[] = []
  const csids: number[] = []

  if (true) {
    const sql = [
      'SELECT CustServId csid, TtsId ticketId FROM Tts',
      'WHERE TtsTypeId = 10 AND PostedTime < ?',
      'AND Status NOT IN ("Closed", "Cancel", "Call")',
    ].join(' ')
    const [rows] = (await pool.execute(sql, [timeLowThreshold])) as any[]
    for (const { csid, ticketId } of rows) {
      csids.push(csid)
      csTicketMap.set(csid, ticketId)
    }
  }

  if (true) {
    const placeHolder = csids.map((_e) => '?').join(', ')
    const sql = [
      'SELECT CustServId csid, Network net',
      'FROM CustomerServiceTechnical',
      `WHERE CustServId IN (${placeHolder})`,
    ].join(' ')
    const [rows] = (await pool.execute(sql, csids)) as any[]
    for (const { csid, net } of rows) {
      if (!IPCIDR.isValidCIDR(net)) continue
      const cidr = new IPCIDR(net)
      cidr.toArray().forEach((e) => {
        ipMap.set(e, csid)
        ips.push(e)
      })
    }
  }

  const placeHolder = ips.map((_e) => '?').join(', ')
  const sql = [
    'SELECT ip_address ip FROM pppoe_last_seen',
    'WHERE last_seen > ?',
    `AND ip_address IN (${placeHolder})`,
  ].join(' ')
  const [rows] = (await pool.execute(sql, [timeHighThreshold, ...ips])) as any[]
  for (const { ip } of rows) {
    const csid = ipMap.get(ip) as number
    const ticket = csTicketMap.get(csid)
    metricLines.push(
      `${metricName}{ip="${ip}",csid="${csid}",ticket="${ticket}"} 1`,
    )
  }
  await writeMetricsFile(
    metricLines,
    ONLINE_TICKET_METRICS_FILE,
    ONLINE_TICKET_METRICS_FILE_TEMP,
  )
}
