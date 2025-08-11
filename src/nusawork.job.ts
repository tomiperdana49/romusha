import { EMPLOYEE_ON_DUTY_NOTIF_PIC_PHONES } from './config'
import { getAllEmployee, getEmployeeSchedule } from './nusawork'
import { sendWaNotif } from './nusawa'

export async function sendEmployeeOnDutyNotif() {
  const nextSunday = getNextSunday()
  const recipients = JSON.parse(EMPLOYEE_ON_DUTY_NOTIF_PIC_PHONES) as string[]
  const schedules = await getEmployeeSchedule(nextSunday)
  const employeeOnDutySchedule = schedules.find((schedule: any) => {
    return (
      schedule.shift_name === 'Manager On Duty' ||
      schedule.shift_name === 'Staff On Duty'
    )
  })
  const message =
    employeeOnDutySchedule.shift_name +
    ' ' +
    employeeOnDutySchedule.date +
    `\n*${employeeOnDutySchedule.name.trim()}*`
  const employees = await getAllEmployee()
  const employeeOnDuty = employees.find((employee: any) => {
    return employee.user_id == employeeOnDutySchedule.user_id
  })
  recipients.push(
    employeeOnDuty.whatsapp
      ? employeeOnDuty.whatsapp
      : employeeOnDuty.mobile_phone,
  )
  recipients.forEach(async (recipient) => {
    sendWaNotif(recipient, message)
  })
}

function getNextSunday(date = new Date()) {
  const day = date.getDay()
  const diff = (0 - day + 7) % 7 || 7
  const nextSunday = new Date(date)
  nextSunday.setDate(date.getDate() + diff)
  return nextSunday
}
