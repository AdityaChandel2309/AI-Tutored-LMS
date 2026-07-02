import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { url?: string }>();

    return next.handle().pipe(
      map((data: unknown) => ({
        data,
        meta: {
          path: request.url ?? null,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
