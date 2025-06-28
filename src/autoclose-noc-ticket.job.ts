import { pool as db } from './nis.mysql'
import axios from 'axios'
import { SYNC_T2T_API_URL, SYNC_T2T_API_KEY } from './config'

const IGNORED_PERIOD = 86400

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
export async function autoCloseNocTickets(): Promise<void> {
  const [rows] = await db.query(
    `
    SELECT tu.TtsId, tu.UpdatedTime, t.CustServId, t.VcId, cs.contactIdT2T
    FROM TtsUpdate tu
    LEFT JOIN Tts t ON tu.TtsId = t.TtsId
    LEFT JOIN Employee e ON t.EmpId = e.EmpId
    LEFT JOIN CustomerServices cs on cs.CustServId = t.CustServId
    WHERE t.TtsTypeId = 7
      AND t.Status = 'Call'
      AND IFNULL(e.DisplayBranchId, e.BranchId) IN ('020', '027', '062')
    ORDER BY tu.TtsId, tu.UpdatedTime DESC
    `,
  )

  const now = new Date()
  const proceeded = new Set<number>()

  for (const row of rows as any[]) {
    const { TtsId, UpdatedTime, CustServId, VcId, contactIdT2T } = row
    if (proceeded.has(TtsId)) continue
    proceeded.add(TtsId)

    const updatedTime = new Date(UpdatedTime)
    if (updatedTime.getTime() + IGNORED_PERIOD * 1000 > now.getTime()) continue

    const [assignRow] = await db.query(
      `SELECT AssignedNo FROM TtsPIC WHERE TtsId = ? ORDER BY AssignedNo DESC LIMIT 1`,
      [TtsId],
    )
    const assignedNo = (assignRow as any[])[0]?.AssignedNo ?? 0

    const action = CustServId > 0 ? '' : 'tidak jadi pasang'
    const successStatus = CustServId > 0 ? 1 : 0

    // Insert into TtsUpdate
    const [insertRes] = await db.query(
      `
      INSERT INTO TtsUpdate (
        TtsId, UpdatedTime, ActionStart, ActionBegin, ActionEnd, ActionStop, EmpId, Action, Note, AssignedNo, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Call')
      `,
      [
        TtsId,
        updatedTime,
        updatedTime,
        updatedTime,
        updatedTime,
        updatedTime,
        'SYSTEM',
        action,
        'closed by SYSTEM',
        assignedNo,
      ],
    )
    const updateId = (insertRes as any).insertId

    // Insert into TtsChange
    await db.query(
      `INSERT INTO TtsChange (TtsUpdateId, field, OldValue, NewValue) VALUES (?, 'Status', 'Call', 'Closed')`,
      [updateId],
    )

    // Update Tts
    await db.query(
      `UPDATE Tts SET Visited = 1, Status = 'Closed', SolvedBy = '' WHERE TtsId = ?`,
      [TtsId],
    )

    // Call Sync T2T
    if (VcId) {
      await processSyncT2T(TtsId, updateId, contactIdT2T, {
        is: {
          apiKey: SYNC_T2T_API_KEY,
          syncT2TUrl: SYNC_T2T_API_URL,
        },
      })
    }
  }
}
