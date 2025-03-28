import { KARMA_ALERT_URL_SEARCH } from './config'
import axios from 'axios'

export async function muteOrphanAlert(): Promise<void> {
  try {
    const alertname = 'unlinked'
    const state = 'active'

    const url = `${KARMA_ALERT_URL_SEARCH}?q=alertname=${encodeURIComponent(alertname)}&q=%40state=${encodeURIComponent(state)}`

    const response = await axios.get(url)

    const groups = response.data.groups

    if (groups) {
      for (const groupId in groups) {
        if (groups.hasOwnProperty(groupId)) {
          const group = groups[groupId]
          const alerts = group.alerts
          if (alerts && Array.isArray(alerts)) {
            alerts.forEach(async (alert, index) => {
              if (alert.labels.iface) {
                const iface = alert.labels.iface
                const regex12 = /^(X[0-9a-f]{12}|[0-9a-f]{13})$/i
                const regex13 = /^[0-9a-f]{12,13}$/i
                if (
                  regex12.test(iface) == false &&
                  regex13.test(iface) == false
                ) {
                  return
                }

                const startDate = new Date()
                const endDate = new Date()
                endDate.setDate(startDate.getDate() + 30)
                const startsAt = startDate.toISOString()
                const endsAt = endDate.toISOString()

                const silencePayload = {
                  matchers: [
                    { name: 'alertname', value: 'unlinked', isRegex: false },
                    {
                      name: 'iface',
                      value: alert.labels.iface,
                      isRegex: false,
                    },
                  ],
                  startsAt: startsAt,
                  endsAt: endsAt,
                  createdBy: 'Tomi',
                  comment: 'reserved',
                }
                try {
                  const silenceUrl =
                    'https://nmx.nusa.net.id/karma/proxy/alertmanager/almmdn/api/v2/silences'
                  const silenceResponse = await axios.post(
                    silenceUrl,
                    silencePayload,
                  )
                  console.log(
                    `Silence created for alert: ${alert.startsAt} - ${alert.endsAt}`,
                  )
                  console.log(silenceResponse.data)
                } catch (error) {
                  console.error('Error creating silence:', error)
                }
              }
            })
          } else {
            console.log('No alerts found in this group.')
          }
        }
      }
    } else {
      console.log('No groups found in the response.')
    }
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}
