import { pool as mysqlDb } from './nis.mysql'
import {
  GRACEPERIOD_HELPDESK,
  GRACEPERIOD_ENGINEER,
  WHATSAPP_NUSACONTACT_API_URL,
  WHATSAPP_NUSACONTACT_API_NAMESPACE,
  WHATSAPP_NUSACONTACT_API_APIKEY,
  WHATSAPP_FEEDBACK_URL,
  WHATSAPP_QUESTION,
  SYNC_T2T_API_URL,
  SYNC_T2T_API_KEY,
} from './config'
import axios from 'axios'

const REQUEST_TICKET = 1
const INCIDENT_TICKET = 2

const HELPDESK_DEPT = new Set(['01', '17', '29'])
const ENGINEER_DEPT = new Set(['04', '34'])

async function processSyncT2T(
  ticketId: number,
  updateId: number,
  contactId: string,
  config: {
    is: {
      apiKey: string
      syncT2TUrl: string
    }
  },
): Promise<number> {
  try {
    const response = await axios.post(
      config.is.syncT2TUrl,
      {
        ttsId: ticketId,
        ttsUpdateId: updateId,
        contactIdT2T: contactId,
      },
      {
        headers: {
          'X-Api-Key': config.is.apiKey,
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    )
    return response.status
  } catch (err: any) {
    console.error(`Failed syncing T2T for ticket ${ticketId}`, err.message)
    return 500
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendWhatsAppWithRetry(
  destination: string,
  JobTitle: string,
  retries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(
        WHATSAPP_NUSACONTACT_API_URL,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: destination,
          type: 'template',
          template: {
            namespace: WHATSAPP_NUSACONTACT_API_NAMESPACE,
            name: 'feedback_score_v05',
            language: { code: 'id' },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: JobTitle }] },
            ],
          },
        },
        {
          headers: {
            'X-Api-Key': WHATSAPP_NUSACONTACT_API_APIKEY,
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      )
      return // success
    } catch (err: any) {
      if (err.response?.status === 429 && attempt < retries) {
        console.warn(
          `Rate limit hit for ${destination} (attempt ${attempt}). Waiting 1 seconds...`,
        )
        await sleep(1000)
      } else {
        throw err
      }
    }
  }
}

export async function autocloseAssignedTicket(): Promise<void> {
  const [solvedTickets] = await mysqlDb.query(
    `
    SELECT tu.TtsId, tu.UpdatedTime, t.TtsTypeId, t.CustId, t.AssignedNo, t.VcId, cs.contactIdT2T
    FROM TtsUpdate tu
    LEFT JOIN Tts t ON tu.TtsId = t.TtsId
    LEFT JOIN Employee e ON t.EmpId = e.EmpId
    LEFT JOIN CustomerServices cs on cs.CustServId = t.CustServId
    WHERE t.TtsTypeId IN (?, ?)
      AND t.Status = 'Call'
      AND t.AssignedNo > 0
      AND IFNULL(e.DisplayBranchId, e.BranchId) IN ('020', '027', '062')
    ORDER BY tu.TtsId, tu.UpdatedTime DESC
    `,
    [REQUEST_TICKET, INCIDENT_TICKET],
  )

  const proceeded = new Set()
  const now = new Date()
  for (const ticket of solvedTickets as any[]) {
    const {
      TtsId,
      UpdatedTime,
      TtsTypeId,
      CustId,
      AssignedNo,
      VcId,
      contactIdT2T,
    } = ticket
    if (proceeded.has(TtsId)) continue
    proceeded.add(TtsId)
    const [rows] = await mysqlDb.query(
      `
        SELECT e.EmpId, e.DeptId, jt.Title AS JobTitle
        FROM TtsPIC tp
        LEFT JOIN Employee e ON tp.EmpId = e.EmpId
        LEFT JOIN JobTitle jt ON e.JobTitle = jt.Id
        WHERE tp.TtsId = ? AND tp.AssignedNo = ?
        `,
      [TtsId, AssignedNo],
    )
    const picRows = rows as {
      EmpId: string
      DeptId: string
      JobTitle: string
    }[]

    if (picRows.length === 0) continue

    const { DeptId, JobTitle } = picRows[0]
    let gracePeriod: number

    let resolver = ''

    if (HELPDESK_DEPT.has(DeptId)) {
      gracePeriod = GRACEPERIOD_HELPDESK
      resolver = 'helpdesk'
    } else if (ENGINEER_DEPT.has(DeptId)) {
      gracePeriod = GRACEPERIOD_ENGINEER
      resolver = 'engineer'
    } else {
      continue
    }

    const updatedTimePlusGrace = new Date(
      new Date(UpdatedTime).getTime() + gracePeriod * 1000,
    )
    if (updatedTimePlusGrace > now) {
      continue
    }
    // Insert into TtsUpdate
    const [insertResult] = await mysqlDb.query(
      `
      INSERT INTO TtsUpdate (
        TtsId, UpdatedTime, ActionStart, ActionBegin, ActionEnd, ActionStop, EmpId, Note, AssignedNo, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        TtsId,
        now,
        now,
        now,
        now,
        now,
        'SYSTEM',
        'closed by SYSTEM',
        AssignedNo,
        'Call',
      ],
    )
    const insertedUpdateId = (insertResult as any).insertId

    // Insert into TtsChange
    await mysqlDb.query(
      `
      INSERT INTO TtsChange (TtsUpdateId, field, OldValue, NewValue)
      VALUES (?, 'Status', 'Call', 'Closed'),
             (?, 'SolvedBy', '', ?)
      `,
      [insertedUpdateId, insertedUpdateId, resolver],
    )

    // Update into Tts
    await mysqlDb.query(
      `
      UPDATE Tts
      SET Visited = ?, Status = 'Closed', SolvedBy = ?
      WHERE TtsId = ?
      `,
      [resolver === 'engineer' ? 1 : 0, resolver, TtsId],
    )

    // Skip feedback sending for REQUEST ticket closed by helpdesk
    if (TtsTypeId === REQUEST_TICKET && resolver === 'helpdesk') {
      continue
    }

    // Fetch ContactNo
    const [contactResult] = (await mysqlDb.query(
      `
      SELECT ContactNo
      FROM TtsContact
      WHERE TtsId = ?
      LIMIT 1
      `,
      [TtsId],
    )) as any[]
    if (contactResult.length === 0) continue

    let destination = contactResult[0].ContactNo
    if (!destination) continue
    if (destination.startsWith('0')) {
      destination = '+62' + destination.substring(1)
    } else if (!destination.startsWith('+')) {
      destination = '+' + destination
    }

    try {
      await sendWhatsAppWithRetry(destination, JobTitle)

      // Save feedback send info
      await axios.post(
        WHATSAPP_FEEDBACK_URL,
        {
          destination,
          question: WHATSAPP_QUESTION,
          customer_id: CustId,
          ticket_id: TtsId,
          tts_update_id: insertedUpdateId,
          assigned_no: AssignedNo,
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      )

      // Call Sync T2T
      if (VcId) {
        await processSyncT2T(TtsId, insertedUpdateId, contactIdT2T, {
          is: {
            apiKey: SYNC_T2T_API_KEY,
            syncT2TUrl: SYNC_T2T_API_URL,
          },
        })
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error(
          `Failed sending WhatsApp feedback for ticket ${TtsId}`,
          err.message,
        )
      } else {
        console.error(
          `Failed sending WhatsApp feedback for ticket ${TtsId}`,
          err,
        )
      }
    }
  }
}
