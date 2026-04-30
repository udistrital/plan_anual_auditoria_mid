import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
  } from '@nestjs/common';
  
  @Catch()
  export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const req = ctx.getRequest();
      const res = ctx.getResponse();
  
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
  
      const response =
        exception instanceof HttpException
          ? exception.getResponse()
          : { message: 'Internal server error' };
  
      const logger = req.log;
  
      logger.error(
        {
          err: exception,
          method: req.method,
          url: req.url,
        },
        'HTTP Exception',
      );
  
      res.status(status).json({
        success: false,
        statusCode: status,
        ...(typeof response === 'string'
          ? { message: response }
          : response),
        path: req.url,
        timestamp: new Date().toISOString(),
      });
    }
  }