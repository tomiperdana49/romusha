import axios from 'axios'
import {
  NUSAWORK_AUTH_TOKEN_API_KEY,
  NUSAWORK_AUTH_TOKEN_API_URL,
  NUSAWORK_EMPLOYEE_API_URL,
} from './config'
import logger from './logger'

export async function fetchNusaworkAuthToken(): Promise<string> {
  const response = await axios.get<{ token: string }>(
    NUSAWORK_AUTH_TOKEN_API_URL,
    {
      headers: { 'X-Api-Key': NUSAWORK_AUTH_TOKEN_API_KEY },
    },
  )
  return response.data.token
}

export async function getAllEmployee(token: string) {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const formatedToday = `${yyyy}-${mm}-${dd}`

  const payload = {
    fields: {
      active_status: ['active'],
    },
    page_count: 10000,
    currentPage: 1,
    periods: [formatedToday, formatedToday],
  }

  try {
    const response = await axios.post(NUSAWORK_EMPLOYEE_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response.data.data.list
  } catch (error: any) {
    logger.error(`Error get all employee: ${error.message}`)
  }
}
