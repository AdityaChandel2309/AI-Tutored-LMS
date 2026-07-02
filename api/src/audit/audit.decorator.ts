import { SetMetadata } from '@nestjs/common';

export interface AuditMetadata {
  action: string;
  entityType?: string;
  getEntityId?: (args: any[], result?: any) => string;
  getMetadata?: (args: any[], result?: any) => Record<string, any>;
}

export const AUDIT_METADATA_KEY = 'audit';

export const Audit = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_METADATA_KEY, metadata);