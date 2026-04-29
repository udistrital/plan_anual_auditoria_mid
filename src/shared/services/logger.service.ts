import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import axios, { AxiosError } from 'axios';

@Injectable()
export class LoggerService implements OnModuleInit {

  constructor(
    private readonly httpService: HttpService,
    @InjectPinoLogger(LoggerService.name) private readonly logger: PinoLogger,
  ) {}

  onModuleInit() {
    const axiosInstance = this.httpService.axiosRef;
    axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.info(
          {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            params: config.params,
          },
          'Outgoing HTTP request',
        );
        return config;
      },
      (error: AxiosError) => {
        this.logger.error(
          { err: error, message: error.message },
          'Request setup error',
        );
        return Promise.reject(error);
      },
    );

    axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.info(
          {
            status: response.status,
            url: response.config.url,
            method: response.config.method?.toUpperCase(),
            length: Array.isArray(response.data.Data) ? response.data.Data.length : 1,
          },
          'HTTP response received',
        );
        return response;
      },
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
