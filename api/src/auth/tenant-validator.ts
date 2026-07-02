import { ForbiddenException } from '@nestjs/common';

/**
 * Shared tenant validation with consistent error messages.
 * Use this to avoid repeating the same validation pattern across services.
 */
export function assertTenant(tenantId: string | null): asserts tenantId is string {
  if (!tenantId) {
    throw new ForbiddenException('Tenant could not be resolved');
  }
}

/**
 * Return type guard for tenant validation.
 * Use when you need the conditional form instead of assertion.
 */
export function hasTenant(tenantId: string | null): tenantId is string {
  return tenantId !== null && tenantId !== undefined && tenantId !== '';
}