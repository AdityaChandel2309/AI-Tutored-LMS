import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EventBus } from '../events/event-bus';

type PrismaMock = {
  $transaction: jest.Mock;
  user: { findFirst: jest.Mock };
  employeeProfile: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
  };
  department: { findUnique: jest.Mock };
  designation: { findUnique: jest.Mock };
};

const prisma: PrismaMock = {
  $transaction: jest.fn(),
  user: { findFirst: jest.fn() },
  employeeProfile: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  department: { findUnique: jest.fn() },
  designation: { findUnique: jest.fn() },
};

const eventBus = { emit: jest.fn() };
let service: EmployeeService;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: PrismaMock) => unknown) => fn(prisma));
  service = new EmployeeService(
    prisma as any,
    eventBus as unknown as EventBus,
  );
});

describe('EmployeeService', () => {
  describe('createEmployee', () => {
    it('throws ConflictException on duplicate employee code', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({ id: 'emp-1' });

      await expect(
        service.createEmployee('t1', { userId: 'u1', employeeCode: 'EMP001' }, 'actor-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('importCsv', () => {
    it('returns error for CSV with only header', async () => {
      const result = await service.importCsv('t1', 'employee_code,user_email', 'actor-1');
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for missing required columns', async () => {
      const result = await service.importCsv('t1', 'name,title\nAlice,Engineer', 'actor-1');
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('Missing required columns');
    });

    it('skips rows with missing required fields', async () => {
      const csv = 'employee_code,user_email\n,alice@test.com\nEMP002,';
      const result = await service.importCsv('t1', csv, 'actor-1');
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBe(2);
    });

    it('handles empty location correctly (M7)', async () => {
      const csv = 'employee_code,user_email,location\nEMP001,alice@test.com,';
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.employeeProfile.upsert.mockResolvedValue({});

      await service.importCsv('t1', csv, 'actor-1');

      const upsertData = (prisma.employeeProfile.upsert as jest.Mock).mock.calls[0][0];

      expect(upsertData.create.location).toBeNull();
      expect(upsertData.update.location).toBeNull();
    });

    it('handles non-empty location correctly (M7)', async () => {
      const csv = 'employee_code,user_email,location\nEMP001,alice@test.com,New York';
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.employeeProfile.upsert.mockResolvedValue({});

      await service.importCsv('t1', csv, 'actor-1');

      const upsertData = (prisma.employeeProfile.upsert as jest.Mock).mock.calls[0][0];

      expect(upsertData.create.location).toBe('New York');
      expect(upsertData.update.location).toBe('New York');
    });

    it('imports successfully with upsert', async () => {
      const csv = 'employee_code,user_email\nEMP001,alice@test.com';
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.employeeProfile.upsert.mockResolvedValue({});

      const result = await service.importCsv('t1', csv, 'actor-1');

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getEmployees', () => {
    it('throws ForbiddenException when tenant is null', async () => {
      await expect(service.getEmployees(null, {})).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
