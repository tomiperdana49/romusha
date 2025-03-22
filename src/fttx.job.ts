import { RecordId } from 'surrealdb'
import { initDb } from './nis.mysql'
import { Surreal } from 'surrealdb'
import {
  SURREALDB_DATABASE,
  SURREALDB_NAMESPACE,
  SURREALDB_PASSWORD,
  SURREALDB_URL,
  SURREALDB_USERNAME,
} from './config'

export async function syncFttxMonitor() {
  const mysqlDb = initDb()
  const surrealDb = new Surreal()
  await surrealDb.connect(SURREALDB_URL, {
    namespace: SURREALDB_NAMESPACE,
    database: SURREALDB_DATABASE,
    auth: { username: SURREALDB_USERNAME, password: SURREALDB_PASSWORD },
  })
  if (!mysqlDb) {
    throw new Error('MySQL initialization failed')
  }
  if (!surrealDb) {
    throw new Error('SurrealDB initialization failed')
  }
  const now = new Date()

  try {
    const query = [
      'SELECT DISTINCT(a.value)',
      'FROM CustomerServiceTechnicalCustom a',
      'LEFT JOIN CustomerServiceTechnicalLink b ON a.technicalTypeId = b.id',
      'LEFT JOIN noc_fiber c ON b.foVendorId = c.id',
      'LEFT JOIN CustomerServices d ON b.custServId = d.CustServId',
      'WHERE',
      "a.attribute = 'Vendor CID'",
      "AND a.technicalType = 'link'",
      "AND d.CustStatus IN ('AC', 'FR')",
      'AND c.vendorId IN (1)',
    ].join(' ')

    const [rows] = await mysqlDb.execute(query)
    for (const row of rows as any[]) {
      if (row.value.trim() === '') {
        continue
      }
      const query = `SELECT VALUE id FROM fttx_rx_power:${row.value}`
      const [queryResult] = (await surrealDb.query(query)) as any
      if (!queryResult || queryResult.length == 0) {
        await surrealDb.create(new RecordId('fttx_rx_power', row.value), {
          synced_at: now,
          created_at: now,
          updated_at: now,
        })
      } else {
        await surrealDb.merge(new RecordId('fttx_rx_power', row.value), {
          synced_at: now,
          updated_at: now,
        })
      }
    }
  } catch (error) {
    console.error(error)
  }
  surrealDb.close()
}
