import * as path from 'path'
import * as fs from 'fs/promises'
import { fetchNusaworkAuthToken, getAllEmployee, getAllJob } from './nusawork'
import {
  EMPLOYEE_CHART_FILE,
  NUSAWORK_EMPLOYEE_PHOTO_URL_PREFIX,
} from './config'
import logger from './logger'

function transformEmployeeData(employees: any[], jobs: Job[]) {
  return employees.map((employee: any) => {
    const reportTo = employees.find(
      (e) => e.user_id == employee.id_report_to_value,
    )
    const jobLevel = jobs.find((j) => j.name == employee.job_level)
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
  const token = await fetchNusaworkAuthToken()
  const employees = await getAllEmployee(token)
  const jobs = await getAllJob(token)
  const chart = transformEmployeeData(employees, jobs)

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

export interface Job {
  id: number
  name: string
  position: number
}
