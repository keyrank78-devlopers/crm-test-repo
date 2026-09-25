import type { BackendRole } from './http'
import type { RoleUi } from '../types'

/** Map backend role → UI workspace role */
export function backendRoleToUi(role: BackendRole | string): RoleUi {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'manager':
      return 'Sales Manager'
    case 'tl':
      return 'Team Leader'
    case 'fse':
      return 'FSE'
    case 'caller':
      return 'Caller'
    case 'dispatcher':
      return 'Dispatch'
    case 'inventory':
      return 'Warehouse'
    default:
      return 'FSE'
  }
}
