import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TercerosService {
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
    let url = `${this.configService.get<string>('TERCEROS_SERVICE')}${endpoint}${id ? '/'+id : ''}` 

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
