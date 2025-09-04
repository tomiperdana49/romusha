import axios from 'axios'

export async function processSyncT2T(
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
