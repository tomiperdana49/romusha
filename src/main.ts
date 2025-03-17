import { connect } from 'nats'
import { processJob } from './job'
import logger from './logger'
import {
  NATS_SERVERS,
  NATS_TOKEN,
  MIN_BACKOFF_DELAY_SECONDS,
  MAX_BACKOFF_DELAY_SECONDS,
  NATS_STREAM,
  NATS_CONSUMER,
} from './config'

async function consumeMessages() {
  let backoffDelay = Number(MIN_BACKOFF_DELAY_SECONDS) * 1000

  const nc = await connect({
    servers: NATS_SERVERS,
    token: NATS_TOKEN,
  })

  process.on('SIGINT', async () => {
    await nc.drain()
    logger.info('NATS connection drained, exiting...')
    process.exit()
  })

  const js = nc.jetstream()
  const c = await js.consumers.get(NATS_STREAM, NATS_CONSUMER)

  try {
    while (true) {
      const fetchedMessages = await c.fetch({ max_messages: 8, expires: 1000 })
      let messagesReceived = false
      for await (const message of fetchedMessages) {
        messagesReceived = true
        processJob(message, nc)
        backoffDelay = 1000
      }
      if (!messagesReceived) {
        await applyBackoff(backoffDelay)
        backoffDelay = Math.min(
          backoffDelay * 2,
          Number(MAX_BACKOFF_DELAY_SECONDS) * 1000,
        )
      }
    }
  } catch (error) {
    logger.error('Error during message consumption: ', error)
  }
}

async function applyBackoff(delayMs: number) {
  logger.info(`Backing off for ${delayMs / 1000} seconds...`)
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

consumeMessages().catch((error) => {
  logger.error('Error consuming messages:', error)
})
