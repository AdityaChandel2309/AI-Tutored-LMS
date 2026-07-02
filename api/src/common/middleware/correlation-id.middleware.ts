import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { requestContext, type RequestContext } from '../logger/structured-logger';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const correlationId = (req.headers['x-request-id'] as string) || randomUUID();
    req.correlationId = correlationId;
    res.setHeader('X-Request-Id', correlationId);

    const ctx: RequestContext = {
      correlationId,
      tenantId: req.tenant?.id,
      userId: req.user?.userId,
    };

    requestContext.run(ctx, () => next());
  }
}
