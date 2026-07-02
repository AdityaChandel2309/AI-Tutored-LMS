import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<{
      status: (code: number) => {
        json: (body: unknown) => void;
      };
    }>();
    const request = httpContext.getRequest<{
      url?: string;
      correlationId?: string;
    }>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Log based on severity
    const logContext = { correlationId: request.correlationId, path: request.url, statusCode };
    if (statusCode >= 500) {
      this.logger.error(JSON.stringify({ ...logContext, stack: exception instanceof Error ? exception.stack : undefined, message: exception instanceof Error ? exception.message : 'Unknown error' }));
    } else if (statusCode >= 400) {
      this.logger.warn(JSON.stringify({ ...logContext, message: exception instanceof Error ? exception.message : 'Client error' }));
    }

    const errorBody = this.buildErrorBody(
      statusCode,
      request.url ?? null,
      request.correlationId ?? null,
      exceptionResponse,
      exception,
    );

    response.status(statusCode).json(errorBody);
  }

  private buildErrorBody(
    statusCode: number,
    path: string | null,
    correlationId: string | null,
    exceptionResponse: unknown,
    exception: unknown,
  ) {
    const baseError = {
      statusCode,
      path,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    if (typeof exceptionResponse === 'string') {
      return {
        error: {
          ...baseError,
          message: exceptionResponse,
        },
      };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObject = exceptionResponse as Record<string, unknown>;

      return {
        error: {
          ...baseError,
          code:
            typeof responseObject.code === 'string'
              ? responseObject.code
              : null,
          message:
            responseObject.message ?? responseObject.error ?? 'Request failed',
          details: responseObject.details ?? null,
        },
      };
    }

    const isServerError = statusCode >= 500;
    return {
      error: {
        ...baseError,
        message:
          isServerError
            ? 'Internal server error'
            : exception instanceof Error
              ? exception.message
              : 'Request failed',
      },
    };
  }
}
