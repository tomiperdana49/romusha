import { initDb } from './nis.mysql'
import {
  WHATSAPP_NUSACONTACT_API_URL,
  WHATSAPP_NUSACONTACT_API_NAMESPACE,
  WHATSAPP_NUSACONTACT_API_APIKEY,
  WHATSAPP_FEEDBACK_URL,
  WHATSAPP_QUESTION,
  GRACEPERIOD_HELPDESK,
  SYNC_T2T_API_KEY,
  SYNC_T2T_API_URL,
} from './config'
import axios from 'axios'

const REQUEST_TICKET = 1
const INCIDENT_TICKET = 2

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

export async function autocloseHelpdeskTicket(): Promise<void> {
  const mysqlDb = initDb()
  if (!mysqlDb) {
    throw new Error('MySQL initialization failed')
  }

  const [solvedTickets] = await mysqlDb.query(
    `
    SELECT tu.TtsId, tu.UpdatedTime, t.TtsTypeId, t.CustId, t.AssignedNo, t.VcId, cs.contactIdT2T, jt.Title
    FROM TtsUpdate tu
    LEFT JOIN Tts t ON tu.TtsId = t.TtsId
    LEFT JOIN Employee e ON t.EmpId = e.EmpId
    LEFT JOIN JobTitle jt ON e.JobTitle = jt.Id
    LEFT JOIN CustomerServices cs on cs.CustServId = t.CustServId
    WHERE t.TtsTypeId IN (?, ?)
      AND t.Status = 'Call'
      AND t.AssignedNo = 0
      AND IFNULL(e.DisplayBranchId, e.BranchId) IN ('020')
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
      Title,
    } = ticket
    if (proceeded.has(TtsId)) continue
    proceeded.add(TtsId)

    const updatedPlusIgnore = new Date(
      new Date(UpdatedTime).getTime() + GRACEPERIOD_HELPDESK * 1000,
    )
    if (updatedPlusIgnore > now) continue

    // Insert into TtsUpdate
    const [insertResult] = await mysqlDb.query(
      `
      INSERT INTO TtsUpdate (
        TtsId, UpdatedTime, ActionStart, ActionBegin, ActionEnd, ActionStop, EmpId, Note, AssignedNo, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [TtsId, now, now, now, now, now, 'SYSTEM', 'closed by SYSTEM', 0, 'Call'],
    )
    const insertedUpdateId = (insertResult as any).insertId

    // Insert into TtsChange
    await mysqlDb.query(
      `
      INSERT INTO TtsChange (TtsUpdateId, field, OldValue, NewValue)
      VALUES (?, 'Status', 'Call', 'Closed'),
             (?, 'SolvedBy', '', 'helpdesk')
      `,
      [insertedUpdateId, insertedUpdateId],
    )

    // Update into Tts
    await mysqlDb.query(
      `
      UPDATE Tts
      SET Visited = 0, Status = 'Closed', SolvedBy = 'helpdesk'
      WHERE TtsId = ?
      `,
      [TtsId],
    )

    // Skip feedback for REQUEST ticket
    if (TtsTypeId === REQUEST_TICKET) continue

    // Fetch contact number
    const [contactResult] = (await mysqlDb.query(
      `SELECT ContactNo FROM TtsContact WHERE TtsId = ? LIMIT 1`,
      [TtsId],
    )) as any[]
    if (contactResult.length === 0 || !contactResult[0].ContactNo) continue

    let destination = contactResult[0].ContactNo
    if (destination.startsWith('0')) {
      destination = '+62' + destination.substring(1)
    } else if (!destination.startsWith('+')) {
      destination = '+' + destination
    }

    try {
      // Send WhatsApp feedback
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
            components: [{ type: 'body', parameters: [{ type: 'text', text: Title }] }],
          },
        },
        {
          headers: {
            'X-Api-Key': WHATSAPP_NUSACONTACT_API_APIKEY,
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      )

      // Save feedback info
      await axios.post(
        WHATSAPP_FEEDBACK_URL,
        {
          destination,
          question: WHATSAPP_QUESTION,
          customer_id: CustId,
          ticket_id: TtsId,
          tts_update_id: insertedUpdateId,
          assigned_no: 0,
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
