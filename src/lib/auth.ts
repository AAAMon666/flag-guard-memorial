import type { PermissionCode, Role } from '../types'
import { roles } from '../data/demo'

export const defaultRole = roles[0]

export function can(role: Role, permission: PermissionCode) {
  return role.permissions.includes(permission)
}

export function maskPhone(phone: string, visible: boolean) {
  if (visible) return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
