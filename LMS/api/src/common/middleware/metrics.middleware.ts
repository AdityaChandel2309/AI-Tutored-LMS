import { Injectable, NestMiddleware } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: any, res: any, next: () => void) {
    if (req.originalUrl?.startsWith('/metrics')) return next();

    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const labels = {
        method: req.method,
        path: req.route?.path ?? req.originalUrl?.split('?')[0] ?? 'unknown',
        status_code: String(res.statusCode),
      };

      this.metrics.httpRequestDuration.observe(labels, duration);
      this.metrics.httpRequestTotal.inc(labels);
    });

    next();
  }
}
