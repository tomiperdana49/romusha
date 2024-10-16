export const NATS_SERVERS = process.env.NATS_SERVERS || 'nats://localhost:4222'
export const NATS_TOKEN = process.env.NATS_TOKEN || ''
export const MIN_BACKOFF_DELAY_SECONDS =
  process.env.MIN_BACKOFF_DELAY_SECONDS || 1
export const MAX_BACKOFF_DELAY_SECONDS =
  process.env.MAX_BACKOFF_DELAY_SECONDS || 32
export const NUSAWORK_AUTH_TOKEN_API_URL =
  process.env.NUSAWORK_AUTH_TOKEN_API_URL || 'https://nusawork.com/api/token'
export const NUSAWORK_AUTH_TOKEN_API_KEY =
  process.env.NUSAWORK_AUTH_TOKEN_API_KEY || ''
export const NUSAWORK_EMPLOYEE_API_URL =
  process.env.NUSAWORK_EMPLOYEE_API_URL || 'https://nusawork.com/api/v4.1/employee/filter'

export const EMPLOYEE_CHART_FILE =
  process.env.EMPLOYEE_CHART_FILE || '/tmp/employee-chart.json'
