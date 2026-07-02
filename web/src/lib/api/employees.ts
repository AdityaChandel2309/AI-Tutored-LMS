import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiFetch } from "./client";
import type { EmployeeProfile, EmployeeListResponse, CsvImportResult } from "../types/organization";

export function getEmployees(params?: { departmentId?: string; designationId?: string; search?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set("departmentId", params.departmentId);
  if (params?.designationId) query.set("designationId", params.designationId);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiGet<{ data: EmployeeListResponse }>(`/employees${qs ? `?${qs}` : ""}`);
}

export function getEmployee(id: string) {
  return apiGet<{ data: EmployeeProfile }>(`/employees/${id}`);
}

export function getReportees(id: string) {
  return apiGet<{ data: EmployeeProfile[] }>(`/employees/${id}/reportees`);
}

export function createEmployee(data: {
  userId: string;
  employeeCode: string;
  departmentId?: string;
  designationId?: string;
  reportingManagerId?: string;
  dateOfJoining?: string;
  location?: string;
  phone?: string;
}) {
  return apiPost<{ data: EmployeeProfile }>("/employees", data);
}

export function updateEmployee(id: string, data: Record<string, unknown>) {
  return apiPatch<{ data: EmployeeProfile }>(`/employees/${id}`, data);
}

export async function importEmployeesCsv(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ data: CsvImportResult }>("/employees/import", {
    method: "POST",
    body: formData,
  });
}

// ─── TanStack Query domain hooks ───────────
// Centralized react-query hooks for the employee directory. The Next.js API
// routes relay the backend's `{ data }` envelope already unwrapped (via
// `relayBackendDataResponse`), so these read the bare response shape directly
// (e.g. `EmployeeListResponse`, NOT `{ data: EmployeeListResponse }`).

export type EmployeeListParams = {
  departmentId?: string;
  designationId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

function employeesQueryString(params?: EmployeeListParams) {
  // Build the query string identically to getEmployees() so the issued
  // request (path + params) is byte-for-byte preserved.
  const query = new URLSearchParams();
  if (params?.departmentId) query.set("departmentId", params.departmentId);
  if (params?.designationId) query.set("designationId", params.designationId);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export const employeeKeys = {
  all: ["employees"] as const,
  list: (params?: EmployeeListParams) =>
    ["employees", "list", params ?? {}] as const,
};

export function useEmployees(params?: EmployeeListParams) {
  return useQuery<EmployeeListResponse>({
    queryKey: employeeKeys.list(params),
    // GET /api/employees (credentials included via apiGet). Response is the
    // unwrapped EmployeeListResponse ({ items, total, page, limit }).
    queryFn: () =>
      apiGet<EmployeeListResponse>(`/employees${employeesQueryString(params)}`),
    placeholderData: (prev) => prev,
  });
}

export function useEmployee(id: string | null) {
  return useQuery<EmployeeProfile>({
    queryKey: ["employees", "detail", id ?? "none"] as const,
    // GET /api/employees/:id → unwrapped EmployeeProfile
    queryFn: () => apiGet<EmployeeProfile>(`/employees/${id}`),
    enabled: Boolean(id),
  });
}

export function useReportees(id: string | null) {
  return useQuery<EmployeeProfile[]>({
    queryKey: ["employees", "reportees", id ?? "none"] as const,
    // GET /api/employees/:id/reportees → unwrapped EmployeeProfile[]
    queryFn: () => apiGet<EmployeeProfile[]>(`/employees/${id}/reportees`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useImportEmployeesCsv() {
  const qc = useQueryClient();
  return useMutation<CsvImportResult, Error, File>({
    // POST /api/employees/import as multipart/form-data — same request the
    // plain importEmployeesCsv() issues, but reading the unwrapped result.
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<CsvImportResult>("/employees/import", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}
