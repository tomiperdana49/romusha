import axios from 'axios'
import Hashids from 'hashids'
import { pool } from '../nis.mysql'
import { sendWaNotif } from '../nusawa'
import {
  FBSTAR_API_PASSWORD,
  FBSTAR_API_USERNAME,
  FBSTAR_TICKET_API_URL,
  FBSTAR_TICKET_METRICS_FILE,
  FBSTAR_TICKET_METRICS_FILE_TEMP,
  FBSTAR_TOKEN_API_URL,
  TICKET_ID_ENCODED_CHARS,
  TICKET_ID_ENCODED_LENGTH,
  TICKET_ID_ENCODED_SALT,
  TICKET_LINK_BASE_URL,
} from '../config'
import { writeMetricsFile } from '../metrics'

const hashids = new Hashids(
  TICKET_ID_ENCODED_SALT,
  TICKET_ID_ENCODED_LENGTH,
  TICKET_ID_ENCODED_CHARS,
)

async function getToken() {
  try {
    const response = await axios.post(
      FBSTAR_TOKEN_API_URL,
      {
        username: FBSTAR_API_USERNAME,
        password: FBSTAR_API_PASSWORD,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    return response.data.token
  } catch (error) {
    console.error(error)
  }
}

export async function syncTickets() {
  const metricName = 'ticket_request_timestamp'
  const metricLines: string[] = []
  const tickets = (await getAllActiveTickets()) as any[]
  const token = await getToken()
  const headers = { Authorization: `Bearer ${token}` }
  for (const { requestId, ticketId, status, category, submitTime } of tickets) {
    if (status === 'Closed') continue
    const submitDatetime = new Date(submitTime)
    const metricLabels: any = {
      requestNumber: requestId,
      ticketNumber: ticketId || '',
      category,
      status,
      link: 'fs',
      since: Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .format(submitDatetime)
        .replace(',', ''),
    }
    const metricValue = Math.floor(submitDatetime.getTime() / 1000)
    try {
      const url = `${FBSTAR_TICKET_API_URL}/${requestId}`
      const response = await axios.get(url, { headers })
      const { requestedAt, ...data } = response.data
      metricLabels.ticketNumber = data.ticketNumber
      metricLabels.category = data.category
      metricLabels.status = data.ticketHistory.at(-1).status
      const sql = [
        'UPDATE fbstar_tickets SET',
        'ticket_id = ?, category = ?, data = ?, updated_at = NOW()',
        'WHERE request_id = ?',
      ].join(' ')
      const [result] = (await pool.execute(sql, [
        data.ticketNumber,
        data.category,
        JSON.stringify(data),
        requestId,
      ])) as any[]
      if (result.affectedRows == 0) {
        const sql = [
          'INSERT INTO fbstar_tickets SET',
          'request_id = ?, ticket_id = ?, category = ?, data = ?,',
          'created_at = NOW(), updated_at = NOW()',
        ].join(' ')
        await pool.execute(sql, [
          requestId,
          data.ticketNumber,
          data.category,
          JSON.stringify(data),
        ])
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error:', error.response?.data || error.message)
      } else {
        console.error('Unexpected error:', error)
      }
    }
    const labelsParts = []
    for (const key in metricLabels) {
      labelsParts.push(`${key}="${metricLabels[key]}"`)
    }
    metricLines.push(`${metricName}{${labelsParts.join(',')}} ${metricValue}`)
  }
  await writeMetricsFile(
    metricLines,
    FBSTAR_TICKET_METRICS_FILE,
    FBSTAR_TICKET_METRICS_FILE_TEMP,
  )
}

async function getAllActiveTickets() {
  try {
    const sql = [
      'SELECT fvt.vendor_ticket_number requestId, ft.ticket_id ticketId,',
      'fvt.vendor_ticket_status status, fvt.insert_time submitTime,',
      'ft.data, t.TtsId ttsId, ft.category',
      'FROM FiberVendorTickets fvt',
      'LEFT JOIN Tts t ON t.TtsId = fvt.ticket_id',
      'LEFT JOIN fbstar_tickets ft ON fvt.vendor_ticket_number = ft.request_id',
      'WHERE NOT (t.Status IN ("Closed", "Cancel", "Pending"))',
      'ORDER BY fvt.insert_time',
    ].join(' ')
    const [rows] = await pool.execute(sql)
    return rows
  } catch (error) {
    console.error(error)
  }
}

async function getAllOverdueTickets(thresholdHours: number = 24) {
  const tickets = (await getAllActiveTickets()) as any[]
  if (!tickets) return []

  return tickets.filter((ticket) => {
    if (ticket.status === 'Closed') return false
    if (ticket.status === 'Pre Closed') return false
    const now = new Date()
    const diffMs = +now - +ticket.submitTime
    if (diffMs < thresholdHours * 1000 * 60 * 60) return false
    return true
  })
}

export async function notifyAllOverdueTickets(
  pic: string,
  thresholdHours: number = 24,
) {
  const tickets = (await getAllOverdueTickets(thresholdHours)) as any[]
  const formatter = Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const now = new Date()
  const messages: string[] = []
  tickets.forEach(
    ({ submitTime, requestId, ticketId, category, data, ttsId }) => {
      const timeString = formatter.format(submitTime).replace(',', '')
      const diffMs = +now - +submitTime
      const diffHours = Math.floor(diffMs / 1000 / 60 / 60)
      messages.push(
        `> ${timeString}, ${diffHours}h ${requestId} ${ticketId} ${category}`,
      )
      const encodedTicketId = hashids.encode(ttsId)
      const ticketIdLink = `${TICKET_LINK_BASE_URL}/?id=${encodedTicketId}`
      messages.push(ticketIdLink)
      try {
        const ticketData = JSON.parse(data)
        const history = ticketData.ticketHistory as any[]
        history.forEach(({ processedAt, picDept, picPerson, status }) => {
          const formattedTime = formatter
            .format(new Date(processedAt))
            .replace(',', '')
          messages.push(
            `- ${formattedTime}, ${status} - ${picDept} ${picPerson}`,
          )
        })
      } catch (error) {
        console.error(error)
      }
    },
  )
  if (!messages) return
  await sendWaNotif(pic, messages.join('\n'))
}

export async function notifyTicketDetail(requestId: string, pic: string) {
  const messages: string[] = []
  const formatter = Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  try {
    const sql = [
      'SELECT ft.ticket_id ticketId, fvt.ticket_id ttsId, ft.data',
      'FROM fbstar_tickets ft',
      'LEFT JOIN FiberVendorTickets fvt',
      'ON ft.request_id = fvt.vendor_ticket_number',
      'WHERE ft.request_id = ?',
    ].join(' ')
    const [rows] = (await pool.execute(sql, [requestId])) as any[]
    const [{ ticketId, ttsId, data }] = rows
    const encodedTicketId = hashids.encode(ttsId)
    const ticketIdLink = `${TICKET_LINK_BASE_URL}/?id=${encodedTicketId}`
    messages.push(`${requestId} ${ticketId}`)
    messages.push(ticketIdLink)
    try {
      const ticketData = JSON.parse(data)
      const history = ticketData.ticketHistory as any[]
      history.forEach(({ processedAt, picDept, picPerson, status }) => {
        const formattedTime = formatter
          .format(new Date(processedAt))
          .replace(',', '')
        messages.push(`- ${formattedTime}, ${status} - ${picDept} ${picPerson}`)
      })
    } catch (error) {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
  }
  if (!messages) return
  await sendWaNotif(pic, messages.join('\n'))
}
