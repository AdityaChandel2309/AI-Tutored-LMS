export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  actorId: string | null;
  type: string;
  entityId: string | null;
  entityType: string | null;
  occurredAt: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityTimelineResponse {
  items: AnalyticsEvent[];
  total: number;
  take: number;
  skip: number;
}

export interface CompletionCountResponse {
  type: string;
  count: number;
}

export interface PassRateResponse {
  attempted: number;
  passed: number;
  passRate: number;
}

export interface EnrollmentCountResponse {
  type: string;
  count: number;
}

export interface CertificateCountResponse {
  type: string;
  count: number;
}
