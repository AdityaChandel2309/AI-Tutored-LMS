import { TenantService } from './tenant.service';

describe('TenantService', () => {
  const tenantById = {
    id: 'tenant-1',
    name: 'Tenant One',
    subdomain: 'tenant-one',
    createdAt: new Date(),
  };

  const tenantBySubdomain = {
    id: 'tenant-2',
    name: 'Tenant Two',
    subdomain: 'tenant-two',
    createdAt: new Date(),
  };

  const prisma = {
    tenant: {
      findUnique: jest.fn(),
    },
  };

  let service: TenantService;
  const originalDefaultSubdomain = process.env.DEFAULT_TENANT_SUBDOMAIN;

  beforeEach(() => {
    prisma.tenant.findUnique.mockReset();
    delete process.env.DEFAULT_TENANT_SUBDOMAIN;
    service = new TenantService(prisma as never);
  });

  afterAll(() => {
    if (originalDefaultSubdomain) {
      process.env.DEFAULT_TENANT_SUBDOMAIN = originalDefaultSubdomain;
      return;
    }

    delete process.env.DEFAULT_TENANT_SUBDOMAIN;
  });

  it('resolves a tenant from x-tenant-id first', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce(tenantById);

    const tenant = await service.resolveTenant({
      tenantIdHeader: 'tenant-1',
      tenantSubdomainHeader: 'tenant-two',
      hostname: 'tenant-two.example.com',
    });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
    });
    expect(tenant).toEqual(tenantById);
  });

  it('resolves a tenant from x-tenant-subdomain', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce(tenantBySubdomain);

    const tenant = await service.resolveTenant({
      tenantSubdomainHeader: ' Tenant-Two ',
    });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { subdomain: 'tenant-two' },
    });
    expect(tenant).toEqual(tenantBySubdomain);
  });

  it('resolves a tenant from the hostname subdomain', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce(tenantBySubdomain);

    const tenant = await service.resolveTenant({
      hostname: 'tenant-two.example.com',
    });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { subdomain: 'tenant-two' },
    });
    expect(tenant).toEqual(tenantBySubdomain);
  });

  it('resolves a tenant from the configured default subdomain', async () => {
    process.env.DEFAULT_TENANT_SUBDOMAIN = 'default';
    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-default',
      name: 'Default LMS',
      subdomain: 'default',
      createdAt: new Date(),
    });

    const tenant = await service.resolveTenant({
      hostname: 'localhost',
    });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { subdomain: 'default' },
    });
    expect(tenant?.subdomain).toBe('default');
  });

  it('returns null when no tenant can be resolved', async () => {
    const tenant = await service.resolveTenant({
      hostname: 'localhost',
    });

    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(tenant).toBeNull();
  });
});
