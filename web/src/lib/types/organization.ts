export interface Department {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  parentId: string | null;
  managerId: string | null;
  parent?: { id: string; name: string } | null;
  children?: { id: string; name: string; code: string }[];
  manager?: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  _count?: { children: number; employees: number };
}

export interface Designation {
  id: string;
  tenantId: string;
  name: string;
  level: number;
  _count?: { employees: number };
}

export interface EmployeeProfile {
  id: string;
  userId: string;
  tenantId: string;
  employeeCode: string;
  departmentId: string | null;
  designationId: string | null;
  reportingManagerId: string | null;
  dateOfJoining: string | null;
  location: string | null;
  phone: string | null;
  user: { id: string; email: string; firstName: string | null; lastName: string | null; avatarUrl?: string | null };
  department?: { id: string; name: string; code: string } | null;
  designation?: { id: string; name: string; level: number } | null;
  reportingManager?: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

export interface EmployeeListResponse {
  items: EmployeeProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface CsvImportResult {
  imported: number;
  errors: string[];
}
