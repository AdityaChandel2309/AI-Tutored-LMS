/**
 * Role model for the platform.
 *
 * Business rules (single source of truth):
 *  - Everyone is an `employee`.
 *  - Anyone who is an `admin` or an `instructor` is also a `learner`.
 *  - `admin` and `instructor` may overlap (a user can be both at once).
 *  - `super_admin` is an elevated admin and also implies `admin`.
 *
 * Keycloak only stores the *assigned* roles (e.g. `admin`, `instructor`).
 * `deriveEffectiveRoles` expands those into the full set the rest of the
 * application uses for authorization and UI gating, so callers never have to
 * re-encode these rules.
 */

export const BASE_ROLE = 'employee';

export const ASSIGNABLE_ROLES = [
  'super_admin',
  'admin',
  'instructor',
  'learner',
  'employee',
] as const;

export type AppRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Expand assigned roles into the effective role set.
 *
 * The result is de-duplicated and stable. Input casing/whitespace is
 * normalized; unknown roles are dropped.
 */
export function deriveEffectiveRoles(assignedRoles: string[] | undefined | null): string[] {
  const normalized = new Set<string>();

  for (const raw of assignedRoles ?? []) {
    if (typeof raw !== 'string') continue;
    const role = raw.trim().toLowerCase();
    if (role) normalized.add(role);
  }

  // Everyone is an employee.
  normalized.add(BASE_ROLE);

  // super_admin implies admin.
  if (normalized.has('super_admin')) {
    normalized.add('admin');
  }

  // admins and instructors are also learners.
  if (normalized.has('admin') || normalized.has('instructor')) {
    normalized.add('learner');
  }

  // Keep only roles the app understands, in a stable priority order.
  const order = ['super_admin', 'admin', 'instructor', 'learner', 'employee'];
  return order.filter((role) => normalized.has(role));
}
