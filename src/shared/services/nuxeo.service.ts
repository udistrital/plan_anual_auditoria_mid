import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { map, catchError, Observable, of } from 'rxjs';
import { LoggerService } from './logger.service';

@Injectable()
export class NuxeoService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Retrieves a file URL from the Gestor Documental API based on the provided UUID. If the response does not contain a file or if an error occurs, it returns an empty string.
   * @param uuid The UUID of the document to retrieve from the Gestor Documental API.
   * @returns An Observable that emits the file URL as a string if successful, or an empty string if the response is not in the expected format or if an error occurs.
   * @throws Error with a detailed message if an error occurs during the retrieval process, including the UUID and the original error message.
   */
  obtenerPorUUID(uuid: string): Observable<string> {
    const methodName = 'obtenerPorUUID';
    const endpoint = `document/${uuid}`;
    const url = `${this.configService.get<string>('GESTOR_DOCUMENTAL_SERVICE')}/document/${uuid}`;
    try {
      return this.httpService.get(url).pipe(
        map((res) => res.data),
        map((res) => {
          if (res?.file == null)
            throw new Error('La respuesta no tiene el formato esperado.');

          return res.file;
        }),
        catchError((error) => {
          this.logger.error(this.createError(endpoint, methodName, error));
          return of('');
        }),
      );
    } catch (error) {
      this.logger.error(this.createError(endpoint, methodName, error));
      return of('');
    }
  }

  /**
   * Creates a new Error object with a detailed message based on the provided UUID, method, and original error.
   * @param uuid The UUID that caused the error.
   * @param method The HTTP method that was being executed when the error occurred.
   * @param error The original error object that was caught.
   * @returns A new Error object with a detailed message and the original stack trace.
   */
  private createError(uuid: string, method: string, error: any): Error {
    const errorMessage = `NuxeoService : ${method} : Error con UUID ${uuid}: ${error.message}`;

    const detailedError = new Error(errorMessage);
    detailedError.stack += `\nCaused by: ${error.stack}`;
    return detailedError;
  }
}
