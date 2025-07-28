import { type JsMsg, type NatsConnection } from 'nats'
import { generateEmployeeChart } from './employee.job'
import logger from './logger'
import { sendEmployeeOnDutyNotif } from './nusawork.job'
import { syncFttxMonitor } from './fttx.job'
import { notifyKarmaAlerts } from './alert.job'
import { collectAndPublishPPPoEData } from './pppoe.job'
import { syncZabbixData } from './zabbix.job'
import { muteOrphanAlert } from './mute-orphan-alert.job'
import { autocloseAssignedTicket } from './autoclose-assigned-ticket.job'
import { autoCloseSurveyTickets } from './autoclose-survey-ticket.job'
import { autocloseHelpdeskTicket } from './autoclose-helpdesk-ticket.job'
import { autoCloseEskalasiTickets } from './autoclose-eskalasi-ticket.job'
import { autoCloseNocTickets } from './autoclose-noc-ticket.job'
import { generateOutdatedIssueMetrics } from './issue.job'
import {
  notifyAllOverdueTickets as notifyAllOverdueFbstarTickets,
  notifyTicketDetail as notifyFbstarTicketDetail,
  syncTickets as syncFbstarTickets,
} from './jobs/fbstar'

export async function processJob(message: JsMsg, nc: NatsConnection) {
  const subjectParts = message.subject.split('.')
  const jobName = subjectParts[2]
  logger.info(`executing job: ${jobName}`)

  switch (jobName) {
    case 'notifyFbstarTicketDetail':
      const requestId = subjectParts[3]
      notifyFbstarTicketDetail(requestId, subjectParts.slice(4).join('.'))
      break
    case 'notifyAllOverdueFbstarTickets':
      const pic = subjectParts.slice(3).join('.')
      notifyAllOverdueFbstarTickets(pic)
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

    default:
      logger.warn(`Unknown job: ${jobName}`)
  }
  message.ack()
}
