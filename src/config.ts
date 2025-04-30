export const NATS_SERVERS = process.env.NATS_SERVERS || 'nats://localhost:4222'
export const NATS_TOKEN = process.env.NATS_TOKEN || ''
export const NATS_STREAM = process.env.NATS_STREAM || 'JOBS'
export const NATS_CONSUMER = process.env.NATS_CONSUMER || 'romusha'
export const MIN_BACKOFF_DELAY_SECONDS =
  process.env.MIN_BACKOFF_DELAY_SECONDS || 1
export const MAX_BACKOFF_DELAY_SECONDS =
  process.env.MAX_BACKOFF_DELAY_SECONDS || 32
export const NUSAWORK_AUTH_TOKEN_API_URL =
  process.env.NUSAWORK_AUTH_TOKEN_API_URL || 'https://nusawork.com/api/token'
export const NUSAWORK_AUTH_TOKEN_API_KEY =
  process.env.NUSAWORK_AUTH_TOKEN_API_KEY || ''
export const NUSAWORK_EMPLOYEE_API_URL =
  process.env.NUSAWORK_EMPLOYEE_API_URL ||
  'https://nusawork.com/api/v4.1/employee/filter'
export const NUSAWORK_SCHEDULE_API_URL =
  process.env.NUSAWORK_SCHEDULE_API_URL ||
  'https://nusawork.com/api/v2/calendar/schedule'

export const EMPLOYEE_CHART_FILE =
  process.env.EMPLOYEE_CHART_FILE || '/tmp/employee-chart.json'

export const EMPLOYEE_ON_DUTY_NOTIF_PIC_PHONES =
  process.env.EMPLOYEE_ON_DUTY_NOTIF_PIC_PHONES || '[]'

export const NUSAWA_MESSAGE_API_URL =
  process.env.NUSAWA_MESSAGE_API_URL ||
  'https://api.nusacontact.com/v2/messages'
export const NUSAWA_MESSAGE_API_TOKEN =
  process.env.NUSAWA_MESSAGE_API_TOKEN || ''

export const NIS_MYSQL_HOST = process.env.NIS_MYSQL_HOST || 'localhost'
export const NIS_MYSQL_PORT = process.env.NIS_MYSQL_PORT || 3306
export const NIS_MYSQL_USER = process.env.NIS_MYSQL_USER || 'root'
export const NIS_MYSQL_PASSWORD = process.env.NIS_MYSQL_PASSWORD || ''
export const NIS_MYSQL_DB = process.env.NIS_MYSQL_DB || 'test'

export const SURREALDB_URL =
  process.env.SURREALDB_URL || 'ws://localhost:8000/rpc'
export const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE || 'nis'
export const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE || 'nis'
export const SURREALDB_USERNAME = process.env.SURREALDB_USERNAME || 'root'
export const SURREALDB_PASSWORD = process.env.SURREALDB_PASSWORD || 'secret'

export const KARMA_ALERT_URL =
  process.env.KARMA_ALERT_URL || 'https://karma.nusa.net.id/alerts.json'
export const WHATSAPP_API_URL =
  process.env.WHATSAPP_API_URL || 'https://nusacontact.com/api/messages'
export const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || 'secret'
export const KARMA_ALERT_WHATSAPP_CONTACT =
  process.env.KARMA_ALERT_WHATSAPP_CONTACT || '6281234567890'

export const PPPOE_SERVERS = process.env.PPPOE_SERVERS || '[]'
export const PPPOE_SERVERS_PRIVATE_KEY =
  process.env.PPPOE_SERVERS_PRIVATE_KEY || ''
export const PPPOE_FETHED_EVENT_SUBJECT =
  process.env.PPPOE_FETHED_EVENT_SUBJECT || 'events.pppoe_data_fetched'

export const ZBX_MYSQL_HOST = process.env.ZBX_MYSQL_HOST || 'localhost'
export const ZBX_MYSQL_USER = process.env.ZBX_MYSQL_USER || 'root'
export const ZBX_MYSQL_PASSWORD = process.env.ZBX_MYSQL_PASSWORD || ''
export const ZBX_MYSQL_DB = process.env.ZBX_MYSQL_DB || 'zabbix'
export const ZBX_MYSQL_PORT = process.env.ZBX_MYSQL_PORT || 3306

export const ZABBIX_PSQL_HOST = process.env.ZABBIX_PSQL_HOST || 'localhost'
export const ZABBIX_PSQL_USER = process.env.ZABBIX_PSQL_USER || 'root'
export const ZABBIX_PSQL_PASSWORD = process.env.ZABBIX_PSQL_PASSWORD || ''
export const ZABBIX_PSQL_DB = process.env.ZABBIX_PSQL_DB || 'zabbix'
export const ZABBIX_PSQL_PORT = process.env.ZABBIX_PSQL_PORT || 5432

export const KARMA_ALERT_URL_SEARCH =
  process.env.KARMA_ALERT_URL_SEARCH || 'https://karma.nusa.net.id/alerts.json'
export const GRACEPERIOD_HELPDESK = Number(process.env.GRACEPERIOD_HELPDESK) || 2025
export const GRACEPERIOD_ENGINEER = Number(process.env.GRACEPERIOD_ENGINEER) || 2025
export const WHATSAPP_NUSACONTACT_API_URL = process.env.WHATSAPP_NUSACONTACT_API_URL || ''
export const WHATSAPP_NUSACONTACT_API_NAMESPACE = process.env.WHATSAPP_NUSACONTACT_API_NAMESPACE || 'nusaContact'
export const WHATSAPP_NUSACONTACT_API_APIKEY = process.env.WHATSAPP_NUSACONTACT_API_APIKEY || ''
export const WHATSAPP_FEEDBACK_URL = process.env.WHATSAPP_FEEDBACK_URL || ''
export const WHATSAPP_QUESTION = process.env.WHATSAPP_QUESTION || ''
export const SYNC_T2T_API_URL = process.env.SYNC_T2T_API_URL || ''
export const SYNC_T2T_API_KEY = process.env.SYNC_T2T_API_KEY || ''
