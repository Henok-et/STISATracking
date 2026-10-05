/**
 * Capability-based authorization.
 *
 * Call sites ask "can this actor do X?" rather than "is this actor an ADMIN?",
 * so introducing a new role (e.g. REGIONAL_COORDINATOR, AUDITOR) means editing
 * this one table instead of every guard in the application.
 */
import type { UserRole } from '@/generated/prisma/enums';

export const CAPABILITIES = [
  // Focal point
  'submission:create',
  'submission:editOwnDraft',
  'submission:submit',
  // Administration
  'submission:review',
  'submission:requestRevision',
  'submission:unlock',
  'submission:approve',
  'submission:publish',
  'submission:unpublish',
  'submission:viewAny',
  'country:manage',
  'user:manage',
  'indicator:manage',
  'reportingCycle:manage',
  'auditLog:view',
  'export:administrative',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  FOCAL_POINT: ['submission:create', 'submission:editOwnDraft', 'submission:submit'],
  ADMIN: CAPABILITIES,
};

export function roleHas(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/**
 * Whether a role's data access is scoped to a single country.
 * Country-scoped actors must additionally pass an ownership check on every
 * mutation — see assertCountryAccess() in ./guards.ts.
 */
export function isCountryScoped(role: UserRole): boolean {
  return role === 'FOCAL_POINT';
}
