import { CanActivate, ExecutionContext, Injectable, SetMetadata, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isFeatureEnabled, type FeatureFlags } from '../../config/feature-flags';

export const FEATURE_FLAG_KEY = 'featureFlag';
export const RequireFeature = (flag: keyof FeatureFlags) => SetMetadata(FEATURE_FLAG_KEY, flag);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const flag = this.reflector.getAllAndOverride<keyof FeatureFlags | undefined>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flag) return true;

    if (!isFeatureEnabled(flag)) {
      throw new ForbiddenException(`Feature "${String(flag)}" is not enabled`);
    }

    return true;
  }
}
