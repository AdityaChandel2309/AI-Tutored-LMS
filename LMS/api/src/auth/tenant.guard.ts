import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_CHECK = 'skipTenantCheck';

/**
 * Guard that ensures a tenant has been resolved from the request.
 * Applied globally — endpoints that don't need tenant context
 * (auth, health) should use @SkipTenantCheck().
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();

    // Only enforce on authenticated routes (those that have gone through JwtAuthGuard)
    if (!request.user) return true;

    if (!request.tenant?.id) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    return true;
  }
}
