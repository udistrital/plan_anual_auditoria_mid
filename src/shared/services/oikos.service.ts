import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

/** Service for interacting with the Oikos API, providing methods for making GET and POST requests to specified endpoints. */
@Injectable()
export class OikosService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtiene datos del Servicio de acuerdo con el endpoint suministrado.
   * @param endpoint - Endpoint del Servicio.
   * @param id - Identificador opcional del recurso a consultar.
   * @param queryParams - Parámetros de búsqueda de la consulta.
   * @returns Datos obtenidos del Servicio.
   */
  async traerData(endpoint: string, id: number | null, queryParams: any) {
    let url = `${this.configService.get<string>('OIKOS_SERVICE')}${endpoint}${id ? '/' + id : ''}`;

    if (queryParams) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }
    const response = await lastValueFrom(this.httpService.get(url));
    return response.data;
  }
}
