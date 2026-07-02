import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const args = context.getArgs();

    return next.handle().pipe(
      tap(async (result) => {
        try {
          const entityId = auditMetadata.getEntityId
            ? auditMetadata.getEntityId(args, result)
            : undefined;

          const metadata = auditMetadata.getMetadata
            ? auditMetadata.getMetadata(args, result)
            : undefined;

          await this.auditService.log({
            action: auditMetadata.action,
            entityType: auditMetadata.entityType,
            entityId,
            metadata,
            ipAddress: request.ip,
            userAgent: request.get('User-Agent'),
          });
        } catch (error) {
          // Log error but don't fail the request
          console.error('Audit logging failed:', error);
        }
      }),
    );
  }
}