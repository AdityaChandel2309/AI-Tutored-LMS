// ─── Shared branding + role humanization ─────────────
// Single source of truth for the product name and for converting
// raw role identifiers into human-readable labels. Pure module —
// no side effects, no imports, safe to use from server or client.

/** The single product name presented to users across the Web_App. */
export const BRAND_NAME = "GAIL Portal";

/**
 * Maps known role identifiers to human-readable labels.
 * Unknown identifiers fall back to Title-Casing (see `humanizeRoles`).
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  instructor: "Instructor",
  learner: "Learner",
  employee: "Employee",
  "employee-only": "Employee",
};

/** Separator used when joining multiple role labels into one readable string. */
const ROLE_SEPARATOR = ", ";

/**
 * Title-Cases an unknown role identifier as a sensible fallback. Handles
 * snake_case, kebab-case, camelCase, and space-separated identifiers by:
 *  1. inserting a boundary at lower→upper case transitions ("superAdmin"
 *     → "super Admin"),
 *  2. splitting on any run of non-alphanumeric characters,
 *  3. capitalizing the first letter of each word and lowercasing the rest.
 *
 * Examples: "team_lead" → "Team Lead", "superAdmin" → "Super Admin",
 * "content-creator" → "Content Creator". Returns "" when the identifier
 * contains no alphanumeric characters.
 */
function titleCaseIdentifier(identifier: string): string {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Converts a list of role identifiers into a human-readable string.
 *
 * - Known identifiers map via `ROLE_LABELS`.
 * - Unknown identifiers are Title-Cased as a fallback.
 * - Empty/falsy entries are dropped and the result is de-duplicated.
 * - Multiple labels are joined with a readable separator (", ").
 * - An empty or undefined/null input returns "".
 *
 * Pure: returns the same output for the same input with no side effects.
 */
export function humanizeRoles(roles: string[]): string {
  if (!roles || roles.length === 0) {
    return "";
  }

  const seen = new Set<string>();
  const labels: string[] = [];

  for (const role of roles) {
    if (!role) {
      continue;
    }

    const label = ROLE_LABELS[role] ?? titleCaseIdentifier(role);
    if (!label || seen.has(label)) {
      continue;
    }

    seen.add(label);
    labels.push(label);
  }

  return labels.join(ROLE_SEPARATOR);
}
