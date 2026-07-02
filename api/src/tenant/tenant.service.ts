import { Injectable } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ResolveTenantInput = {
  hostname?: string;
  tenantIdHeader?: string;
  tenantSubdomainHeader?: string;
};

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async resolveTenant({
    hostname,
    tenantIdHeader,
    tenantSubdomainHeader,
  }: ResolveTenantInput): Promise<Tenant | null> {
    const headerTenantId = tenantIdHeader?.trim();
    if (headerTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: headerTenantId },
      });

      if (tenant) {
        return tenant;
      }
    }

    const requestedSubdomain =
      this.normalizeSubdomain(tenantSubdomainHeader) ??
      this.extractSubdomain(hostname) ??
      this.normalizeSubdomain(process.env.DEFAULT_TENANT_SUBDOMAIN);

    if (!requestedSubdomain) {
      return null;
    }

    const subdomainTenant = await this.prisma.tenant.findUnique({
      where: {
        subdomain: requestedSubdomain,
      },
    });

    if (subdomainTenant) {
      return subdomainTenant;
    }

    return null;
  }

  private normalizeSubdomain(subdomain?: string | null): string | null {
    const normalizedSubdomain = subdomain?.trim().toLowerCase();

    return normalizedSubdomain || null;
  }

  private extractSubdomain(hostname?: string): string | null {
    if (!hostname) {
      return null;
    }

    const normalizedHost = hostname.split(':')[0].toLowerCase();
    if (normalizedHost.endsWith('.localhost')) {
      const localhostSegments = normalizedHost.split('.');
      return localhostSegments[0] || null;
    }

    if (normalizedHost === 'localhost') {
      return null;
    }

    const segments = normalizedHost.split('.');
    if (segments.length < 3) {
      return null;
    }

    return segments[0] || null;
  }
}
