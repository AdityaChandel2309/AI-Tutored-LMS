import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Tenant } from '@prisma/client';
import { TenantService } from './tenant.service';

export type AuthenticatedUserContext = {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string | null;
};

export type TenantAwareRequest = Request & {
  tenant?: Tenant | null;
  user?: AuthenticatedUserContext;
};

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: TenantAwareRequest, _res: Response, next: NextFunction) {
    req.tenant = await this.tenantService.resolveTenant({
      hostname: req.hostname,
      tenantIdHeader: req.header('x-tenant-id'),
      tenantSubdomainHeader: req.header('x-tenant-subdomain'),
    });

    next();
  }
}
