import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException && status < 500) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else {
        const details = body as { message?: unknown };

        if (typeof details.message === 'string') {
          message = details.message;
        } else if (
          Array.isArray(details.message) &&
          details.message.every((item) => typeof item === 'string')
        ) {
          message = details.message as string[];
        } else {
          message = exception.message;
        }
      }
    }

    response.status(status).json({
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }
}