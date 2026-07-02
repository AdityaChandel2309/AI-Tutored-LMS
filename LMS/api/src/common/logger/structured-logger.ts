import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class StructuredLogger extends ConsoleLogger {
  constructor(logLevels?: LogLevel[]) {
    super('', { logLevels });
  }

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    const ctx = requestContext.getStore();
    const entry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      correlationId: ctx?.correlationId ?? null,
      tenantId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
      context: this.context || null,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };
    return JSON.stringify(entry) + '\n';
  }
}
