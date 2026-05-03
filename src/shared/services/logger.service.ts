import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import axios, { AxiosError } from 'axios';

@Injectable()
@Catch()
export class LoggerService implements OnModuleInit, ExceptionFilter {

  constructor(
    private readonly httpService: HttpService,
    @InjectPinoLogger(LoggerService.name) private readonly logger: PinoLogger,
  ) {}

  // configura interceptores de Axios para loguear errores en peticiones HTTP
  onModuleInit() {
    const axiosInstance = this.httpService.axiosRef;
    axiosInstance.interceptors.request.use(
      (config) => config, // se deja pasar la configuración sin modificar
      (error: AxiosError) => {
        this.logger.error(
          { err: error, message: error.message },
          'Request setup error',
        );
        return Promise.reject(error);
      },
    );

    axiosInstance.interceptors.response.use(
      (response) => response, //se deja pasar la respuesta sin modificar
      (error: AxiosError) => {
        const isAxiosError = axios.isAxiosError(error);

        if (isAxiosError && error.response) {
          // Error con respuesta del servidor (4xx, 5xx)
          this.logger.error(
            {
              err: {
                message: error.message,
                code: error.code,
                status: error.response.status,
                statusText: error.response.statusText,
                url: error.config?.url,
                method: error.config?.method?.toUpperCase(),
                requestData: error.config?.data,
                responseData: error.response.data,
                headers: error.response.headers,
              },
            },
            `Axios HTTP error [${error.response.status}]: ${error.config?.url}`,
          );
        } else if (isAxiosError && error.request) {
          // Sin respuesta (timeout, red caída)
          this.logger.error(
            {
              err: {
                message: error.message,
                code: error.code,
                url: error.config?.url,
                method: error.config?.method?.toUpperCase(),
                timeout: error.config?.timeout,
              },
            },
            `Axios no-response error: ${error.config?.url}`,
          );
        } else {
          // Error inesperado al configurar la petición
          this.logger.error(
            { err: error },
            'Axios unexpected error',
          );
        }

        return Promise.reject(error);
      },
    );
  }

  // Implementación del filtro de excepciones global para capturar y loguear errores no manejados en los controladores
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();

    const { status, body } = this.resolve(exception);

    // Log centralizado según tipo
    this.log(exception, request, status);

    response.status(status).json({
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    // 1. HttpException de NestJS (BadRequestException, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      
      if (typeof res === 'string') {
        return {
          status,
          body: {
            statusCode: status,
            message: res,
            details: null,
          },
        };
      }

      const responseObject = res as Record<string, any>;

      return {
        status,
        body: {
          statusCode: status,
          message: responseObject.message || 'Unexpected error',
          details: {
            ...responseObject,
            message: undefined, 
          },
        },
      };
    }

    // 2. Error de Axios con respuesta del servidor
    if (axios.isAxiosError(exception)) {
      const status =
        exception.response?.status ?? HttpStatus.BAD_GATEWAY;
    
      const responseData = exception.response?.data;
    
      return {
        status,
        body: {
          statusCode: status,
          message: 'Error en servicio externo',
          details: {
            detail: responseData ?? null,
            url: exception.config?.url,
          },
        },
      };
    }

    // 3. Cualquier otro error no controlado
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { message: 'Internal server error' },
    };
  }

  private log(exception: unknown, request: Request, status: number) {
    const meta = {
      method: request.method,
      url: request.url,
      status: status,
      body: request.body,
      code: (exception as any)?.code,
    };

    // Error inesperado — siempre error
    this.logger.error(
      { ...meta },
      'Unhandled exception',
    );
  }

  error(error: any, message?: string) {
    this.logger.error(
      {
        err: {
          message: error?.message,
          code: error?.code,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: error?.config?.url,
          method: error?.config?.method?.toUpperCase(),
          requestData: error?.config?.data,
          responseData: error?.response?.data,
          headers: error?.response?.headers,
        },
      },
      message ? `${message}` : '' + `[${error.response.status}]: ${error.config?.url}`
    );
  }
}
