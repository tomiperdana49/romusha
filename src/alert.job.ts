import {
  KARMA_ALERT_URL,
  KARMA_ALERT_WHATSAPP_CONTACT,
  WHATSAPP_API_URL,
  WHATSAPP_API_TOKEN,
} from './config'

interface Alert {
  labels: Record<string, string>
  startsAt: string
}

interface AlertGroup {
  labels: Record<string, string>
  alerts: Alert[]
}

interface AlertResponse {
  groups: Record<string, AlertGroup>
}

/**
 * Formats a set of key-value labels into a string.
 * If a key is specified in `keysToQuote` and its value contains whitespace,
 * the value is wrapped in quotes.
 *
 * @param labels - The labels object to format.
 * @param keysToQuote - Array of keys whose values should be quoted when necessary.
 * @returns A string representing the formatted labels.
 */
function formatLabels(
  labels: Record<string, string>,
  keysToQuote: string[] = [],
): string {
  return Object.entries(labels)
    .map(([key, value]) => {
      const needsQuote = keysToQuote.includes(key) && /\s/.test(value)
      const formattedValue = needsQuote ? `"${value}"` : value
      return `${key}=${formattedValue}`
    })
    .join(' ')
}

/**
 * Converts an ISO date string into a human-readable format.
 * The date is adjusted to WIB (UTC+7). If the alert occurred today,
 * the time is returned in HH:mm format; otherwise, the full date and time is returned.
 *
 * @param startsAt - The ISO date string to format.
 * @returns A formatted date string.
 */
function formatAlertDate(startsAt: string): string {
  const date = new Date(startsAt)
  // Adjust to WIB (UTC+7)
  const wibOffsetMs = 7 * 60 * 60 * 1000
  const wibDate = new Date(date.getTime() + wibOffsetMs)

  const todayStr = new Date().toISOString().split('T')[0]
  const alertDateStr = wibDate.toISOString().split('T')[0]

  if (todayStr === alertDateStr) {
    // Return time in HH:mm format
    return `"${wibDate.toTimeString().slice(0, 5)}"`
  } else {
    // Return full date and time (YYYY-MM-DD HH:mm:ss)
    const [datePart, timePart] = wibDate.toISOString().split('T')
    const formattedTime = timePart.split('.')[0]
    return `"${datePart} ${formattedTime}"`
  }
}

/**
 * Sends a WhatsApp message containing the provided alert text.
 *
 * @param alertMessage - The message text to send.
 */
async function sendWhatsAppMessage(alertMessage: string): Promise<void> {
  const payload = {
    to: KARMA_ALERT_WHATSAPP_CONTACT,
    body: 'text',
    text: alertMessage,
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    if (!response.ok) {
      throw new Error(
        `Failed to send message: ${response.status} - ${responseText}`,
      )
    }
    console.log('WhatsApp message sent successfully:', responseText)
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error sending WhatsApp message:', error.message)
      console.error(error.stack)
    } else {
      console.error('Unknown error sending WhatsApp message')
    }
  }
}

/**
 * Fetches alerts from the KARMA endpoint, processes each alert group,
 * and sends a formatted WhatsApp message for groups that are not
 * labeled as "warning" or "informational".
 */
export async function notifyKarmaAlerts(): Promise<void> {
  try {
    const response = await fetch(KARMA_ALERT_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data: AlertResponse = await response.json()

    for (const group of Object.values(data.groups)) {
      // Skip groups with non-critical severities
      if (
        group.labels.severity === 'warning' ||
        group.labels.severity === 'informational'
      ) {
        continue
      }

      // Format the group header (e.g. using keys that might need quoting)
      const header = formatLabels(group.labels, ['alertname'])

      // Format each alert within the group
      const alertsBody = group.alerts
        .map((alert) => {
          const alertLabelsStr = formatLabels(alert.labels)
          const formattedSince = formatAlertDate(alert.startsAt)
          return `  ${alertLabelsStr} since=${formattedSince}`
        })
        .join('\n')

      const messageBody = `${header}\n${alertsBody}`
      await sendWhatsAppMessage(messageBody)
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error fetching alerts:', error.message)
      console.error(error.stack)
    } else {
      console.error('Unknown error fetching alerts')
    }
  }
}
