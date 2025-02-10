import { type JsMsg } from 'nats'
import { generateEmployeeChart } from './employee.job'
import logger from './logger'
import { sendEmployeeOnDutyNotif } from './nusawork.job'
import { syncFttxMonitor } from './sync.job'
import { notifyKarmaAlerts } from './alert.job'

export async function processJob(message: JsMsg) {
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

    default:
      logger.warn(`Unknown job: ${jobName}`)
  }
  message.ack()
}
