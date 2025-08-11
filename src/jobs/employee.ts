import * as path from 'path'
import * as fs from 'fs/promises'
import {
  getAllEmployee,
  getAllJobLevel,
  getEmployeeSchedule,
} from '../nusawork'
import {
  EMPLOYEE_CHART_FILE,
  EMPLOYEE_ON_DUTY_NOTIF_PIC_PHONES,
  NUSAWORK_EMPLOYEE_PHOTO_URL_PREFIX,
} from '../config'
import logger from '../logger'
import { sendWaNotif } from '../nusawa'

function transformEmployeeData(employees: any[], jobLevels: any[]) {
  return employees.map((employee: any) => {
    const reportTo = employees.find(
      (e) => e.user_id == employee.id_report_to_value,
    )
    const jobLevel = jobLevels.find((j) => j.name == employee.job_level)
    return {
      IDEmployee: employee.employee_id,
      Nama: employee.full_name.trim(),
      Jabatan: employee.job_position,
      Departemen: employee.organization_name,
      IDAtasan:
        reportTo.employee_id == employee.employee_id
          ? '-'
          : reportTo.employee_id,
      URLPhoto: NUSAWORK_EMPLOYEE_PHOTO_URL_PREFIX + employee.photo_profile,
      Level: jobLevel?.position,
    }
  })
}

export async function generateEmployeeChart() {
  const employees = await getAllEmployee()
  const jobLevels = await getAllJobLevel()
  const chart = transformEmployeeData(employees, jobLevels)

  const tempDir = await fs.mkdtemp(
    path.join(path.dirname(EMPLOYEE_CHART_FILE), 'employee-chart-'),
  )
  const tempFilePath = path.join(tempDir, 'employee-chart.json')

  try {
    await fs.writeFile(tempFilePath, JSON.stringify(chart, null, 2), 'utf-8')
    await fs.rename(tempFilePath, EMPLOYEE_CHART_FILE)
  } catch (error) {
    logger.error('Error occured during file operations: ', error)
  } finally {
    try {
      await fs.rmdir(tempDir, { recursive: true })
    } catch (cleanupError) {
      logger.error(
        'Error during cleanup of temporary directory: ',
        cleanupError,
      )
    }
  }
}

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
