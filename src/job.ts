import { type JsMsg, type NatsConnection } from 'nats'
import { generateEmployeeChart } from './employee.job'
import logger from './logger'
import { sendEmployeeOnDutyNotif } from './nusawork.job'
import { syncFttxMonitor } from './fttx.job'
import { notifyKarmaAlerts } from './alert.job'
import { collectAndPublishPPPoEData } from './pppoe.job'
import { syncZabbixData } from './zabbix.job'

export async function processJob(message: JsMsg, nc: NatsConnection) {
  const jobName = message.subject.split('.')[2]
  logger.info(`executing job: ${jobName}`)

  switch (jobName) {
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
      syncZabbixData()
      break

    default:
      logger.warn(`Unknown job: ${jobName}`)
  }
  message.ack()
}
