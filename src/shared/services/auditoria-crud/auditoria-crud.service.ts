import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { environment as env } from 'src/config/configuration';

@Injectable()
export class AuditoriaCrudService {
    constructor(private readonly httpService: HttpService) {}

      /**
   * Obtiene datos de la API CRUD de acuerdo con el endpoint suministrado.
   * @param endpoint - Endpoint de la API CRUD.
   * @param id - Identificador opcional del recurso a consultar.
   * @param queryParams - Parámetros de búsqueda de la consulta.
   * @returns Datos obtenidos de la API CRUD.
   */
  async traerDataCrud(endpoint: string, id: string | null, queryParams: any) {
    let url = `${env().PLAN_AUDITORIA_CRUD_SERVICE}${endpoint}${id ? '/'+id : ''}` 

    if (queryParams) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error
      );
    }
  }

}
