import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { environment } from "src/config/configuration";
import { HttpService } from "@nestjs/axios";
import { Observable, map, catchError, lastValueFrom } from "rxjs";
import { ConfigService } from '@nestjs/config';

/** Service for interacting with the Gestor Documental API, providing methods for making GET and POST requests to specified endpoints. */
@Injectable()
export class GestorDocumentalService {

  /** The base URL for the Gestor Documental API, loaded from the environment configuration. */
  private readonly baseUrl = environment.GESTOR_DOCUMENTAL_SERVICE;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Obtiene datos del Servicio de acuerdo con el endpoint suministrado.
   * @param endpoint - Endpoint del Servicio.
   * @param id - Identificador opcional del recurso a consultar.
   * @param queryParams - Parámetros de búsqueda de la consulta.
   * @returns Datos obtenidos del Servicio.
   */
  async traerData(endpoint: string, id: string | null, queryParams: any) {
    let url = `${this.configService.get<string>('GESTOR_DOCUMENTAL_SERVICE')}${endpoint}${id ? '/'+id : ''}` 

    if (queryParams) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error
      );
    }
  }



  /**
   * Performs a GET request to the extended URL, which is the base URL appended with the provided endpoint.
   * @param endpoint The endpoint to which the GET request will be made, appended to the base URL.
   * @returns An Observable that emits the response data from the GET request.
   * @throws Error with a detailed message if the GET request fails.
   */
  get(endpoint: string): Observable<any> {
    const methodName = 'get';
    try {
      const response = this.httpService.get(`${this.baseUrl}/${endpoint}`);
      return response.pipe(
        map(res => res.data),
        catchError(error => { throw this.createError(endpoint, methodName, error); })
      );
    } catch (error) {
      throw this.createError(endpoint, methodName, error);
    }
  }

  /**
   * Performs a POST request to the extended URL with the provided element as the request body.
   * @param endpoint The endpoint to which the POST request will be made, appended to the base URL.
   * @param element The data to be sent in the body of the POST request.
   * @returns An Observable that emits the response data from the POST request.
   * @throws Error with a detailed message if the POST request fails.
   */
  postAny(endpoint: string, element: any): Observable<any> {
    const methodName = 'postAny';
    try {
      const response = this.httpService.post(`${this.baseUrl}/${endpoint}`, element);
      return response.pipe(
        map(res => res.data),
        catchError(error => { throw this.createError(endpoint, methodName, error); })
      );
    } catch (error) {
      throw this.createError(endpoint, methodName, error);
    }
  }

  /**
   * Creates a new Error object with a detailed message based on the provided endpoint, method, and original error.
   * @param endpoint The endpoint that caused the error. 
   * @param method The HTTP method that was being executed when the error occurred.
   * @param error The original error object that was caught.
   * @returns A new Error object with a detailed message and the original stack trace.
   */
  private createError(endpoint: string, method: string, error: any): Error {
    let errorMessage = `GestorDocumentalService : ${method} : Error on endpoint ${endpoint}: `;

    if (error.response)
      errorMessage += `Request failed with status code ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    else
      errorMessage += `Error setting up the request: ${error.message}`;
      
    const detailedError = new Error(errorMessage);
    detailedError.stack += `\nCaused by: ${error.stack}`;
    return detailedError;
  }

}
