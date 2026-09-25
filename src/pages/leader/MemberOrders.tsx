import { useParams } from 'react-router-dom'
import { useAppState } from '../../api/store'
import { SalesRegister } from '../admin/SalesRegister'
import { PageHeader } from '../../components/ui/primitives'

export function MemberOrders() {
  const { id } = useParams()
  const state = useAppState()
  const emp = state.employees.find((e) => e.employee_id === id)
  if (!emp) return <PageHeader title="Person not found" />
  return <SalesRegister employeeId={emp.employee_id} title={`${emp.employee_name}'s orders`} />
}
