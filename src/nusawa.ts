import axios from 'axios'
import { NUSAWA_MESSAGE_API_TOKEN, NUSAWA_MESSAGE_API_URL } from './config'

export async function sendWaNotif(to: string, message: string) {
  await axios.post(
    NUSAWA_MESSAGE_API_URL,
    { to, body: 'text', text: message },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NUSAWA_MESSAGE_API_TOKEN}`,
      },
    },
  )
}
