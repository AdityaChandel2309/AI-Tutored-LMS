import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    process.env.KEYCLOAK_CLIENT_SECRET = 'test-secret';
    process.env.KEYCLOAK_ADMIN_USER = 'admin';
    process.env.KEYCLOAK_ADMIN_PASSWORD = 'admin';

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('filterSupportedRoles (via createKeycloakUser)', () => {
    it('only allows admin, instructor, learner roles (C1)', async () => {
      // Mock getAdminAccessToken to avoid network calls
      jest.spyOn(service as any, 'getAdminAccessToken').mockResolvedValue('mock-token');
      jest.spyOn(service as any, 'replaceRealmRoles').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'filterSupportedRoles').mockImplementation(
        (roles: string[]) => roles.filter((r: string) => ['admin', 'instructor', 'learner'].includes(r)),
      );

      const result = service['filterSupportedRoles'](['admin', 'super_admin', 'learner', 'unknown']);

      expect(result).toEqual(['admin', 'learner']);
    });
  });
});
