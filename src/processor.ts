import { type JsMsg, type NatsConnection } from 'nats'
import { generateEmployeeChart, sendEmployeeOnDutyNotif } from './jobs/employee'
import logger from './logger'
import { syncFttxMonitor } from './fttx.job'
import { notifyKarmaAlerts } from './alert.job'
import { collectAndPublishPPPoEData } from './pppoe.job'
import { syncZabbixData } from './zabbix.job'
import { muteOrphanAlert } from './mute-orphan-alert.job'
import { generateOutdatedIssueMetrics } from './jobs/issue'
import {
  autocloseAssignedTicket,
  autoCloseEskalasiTickets,
  autocloseHelpdeskTicket,
  autoCloseNocTickets,
  autoCloseSurveyTickets,
  autoCloseMonitoringTickets,
} from './jobs/auto-close-ticket'
import {
  notifyAllOverdueTickets as notifyAllOverdueFbstarTickets,
  notifyTicketDetail as notifyFbstarTicketDetail,
  syncTickets as syncFbstarTickets,
  updateOfflineSubscribers as updateFbstarOfflineSubscribers,
} from './jobs/fbstar'
import { exportOnlinePppoeTicketMetrics } from './jobs/ticket'
import { exportIncompleteSubscriberDataMetrics } from './jobs/subscriber'
import { syncIforteZabbixSubscriberGraphs } from './jobs/iforte'

export async function processJob(message: JsMsg, nc: NatsConnection) {
  const subjectParts = message.subject.split('.')
  const jobName = subjectParts[2]
  logger.info(`executing job: ${jobName}`)

  switch (jobName) {
    case 'updateFbstarOfflineSubscribers':
      updateFbstarOfflineSubscribers()
      break
    case 'syncIforteZabbixSubscriberGraphs':
      syncIforteZabbixSubscriberGraphs()
      break
    case 'exportIncompleteSubscriberDataMetrics':
      exportIncompleteSubscriberDataMetrics()
      break
    case 'exportOnlinePppoeTicketMetrics':
      exportOnlinePppoeTicketMetrics()
      break
    case 'notifyFbstarTicketDetail':
      const requestId = subjectParts[3]
      notifyFbstarTicketDetail(requestId, subjectParts.slice(4).join('.'))
      break
    case 'notifyAllOverdueFbstarTickets':
      notifyAllOverdueFbstarTickets(
        subjectParts.slice(4).join('.'),
        Number(subjectParts[3]),
      )
      break
    case 'syncFbstarTickets':
      syncFbstarTickets()
      break
    case 'generateOutdatedIssueMetrics':
      generateOutdatedIssueMetrics()
      break
    case 'generateEmployeeChart':
      generateEmployeeChart()
      break
    case 'sendEmployeeOnDutyNotif':
      sendEmployeeOnDutyNotif()
      break
    case 'syncFttxMonitor':
      syncFttxMonitor()
      break
    case 'notifyKarmaAlerts':
      notifyKarmaAlerts()
      break
    case 'collectAndPublishPPPoEData':
      collectAndPublishPPPoEData(nc)
      break
    case 'syncZabbixData':
      const date = subjectParts[3]
      syncZabbixData(date)
      break
    case 'muteOrphanAlert':
      muteOrphanAlert()
      break
    case 'autocloseAssignedTicket':
      autocloseAssignedTicket()
      break
    case 'autoCloseSurveyTickets':
      autoCloseSurveyTickets()
      break
    case 'autocloseHelpdeskTicket':
      autocloseHelpdeskTicket()
      break
    case 'autoCloseEskalasiTickets':
      autoCloseEskalasiTickets()
      break
    case 'autoCloseNocTickets':
      autoCloseNocTickets()
      break
    case 'autoCloseMonitoringTickets':
      autoCloseMonitoringTickets()
      break

    default:
      logger.warn(`Unknown job: ${jobName}`)
  }
  message.ack()
}
