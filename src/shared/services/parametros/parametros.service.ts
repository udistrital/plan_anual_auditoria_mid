import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";

/** Service for interacting with the Parametros API, providing methods for making GET and POST requests to specified endpoints. */
@Injectable()
export class ParametrosService {

  /** The base URL for the Parametros API, loaded from the environment configuration. */

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Performs a GET request to the extended URL, which is the base URL appended with the provided endpoint.
   * @param endpoint The endpoint to which the GET request will be made, appended to the base URL.
   * @returns An Observable that emits the response data from the GET request.
   * @throws Error with a detailed message if the GET request fails.
   */
  async get(endpoint: string, id: number | null, queryParams: any): Promise<any> {
    let url = `${this.configService.get<string>('PARAMETROS_SERVICE')}${endpoint}${id ? '/'+id : ''}`
    
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

}
