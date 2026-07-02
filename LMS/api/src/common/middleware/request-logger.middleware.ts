import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { requestContext } from '../logger/structured-logger';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: any, res: any, next: () => void) {
    const { method, originalUrl } = req;

    // Skip health endpoints
    if (originalUrl.startsWith('/health')) return next();

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const ctx = requestContext.getStore();

      const entry = {
        method,
        path: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        correlationId: ctx?.correlationId ?? req.correlationId,
        tenantId: ctx?.tenantId ?? req.tenant?.id,
        userAgent: req.headers['user-agent'] ?? null,
      };

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(entry));
      } else if (statusCode >= 400) {
        this.logger.warn(JSON.stringify(entry));
      } else {
        this.logger.log(JSON.stringify(entry));
      }
    });

    next();
  }
}
