import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditoriaCrudService {
  private baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'PLAN_AUDITORIA_CRUD_SERVICE',
    );
  }

  /**
   * Obtiene datos de la API CRUD de acuerdo con el endpoint suministrado.
   * @param endpoint - Endpoint de la API CRUD.
   * @param id - Identificador opcional del recurso a consultar.
   * @param queryParams - Parámetros de búsqueda de la consulta.
   * @returns Datos obtenidos de la API CRUD.
   */
  async traerDataCrud(endpoint: string, id: string | null, queryParams: any) {
    let url = `${this.baseUrl}${endpoint}${id ? '/' + id : ''}`;

    if (queryParams) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }

    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error: any) {
      console.error('Error en traerDataCrud:', {
        url,
        error: error?.response?.data || error.message,
      });

      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crea un nuevo recurso en el endpoint especificado.
   * @param endpoint - Endpoint de la API CRUD.
   * @param data - Objeto con la información a crear.
   * @returns Recurso creado.
   */
  async post(endpoint: string, data: any) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await lastValueFrom(this.httpService.post(url, data));
      return response.data;
    } catch (error: any) {
      console.error('Error en create:', {
        url,
        data,
        error: error?.response?.data || error.message,
      });

      throw new HttpException(
        'Error al crear el recurso',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Actualiza un recurso existente por su ID.
   * @param endpoint - Endpoint de la API CRUD.
   * @param id - Identificador del recurso a actualizar.
   * @param data - Datos a actualizar.
   * @returns Recurso actualizado.
   */
  async put(endpoint: string, id: string, data: any) {
    if (!id) {
      throw new HttpException(
        'El ID es obligatorio para actualizar',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = `${this.baseUrl}${endpoint}/${id}`;

    try {
      const response = await lastValueFrom(this.httpService.put(url, data));
      return response.data;
    } catch (error: any) {
      console.error('Error en update:', {
        url,
        data,
        error: error?.response?.data || error.message,
      });

      throw new HttpException(
        'Error al actualizar el recurso',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina un recurso por su ID (eliminación lógica o física dependiendo del API).
   * @param endpoint - Endpoint de la API CRUD.
   * @param id - Identificador del recurso a eliminar.
   * @returns Respuesta de la API.
   */
  async delete(endpoint: string, id: string) {
    if (!id) {
      throw new HttpException(
        'El ID es obligatorio para eliminar',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = `${this.baseUrl}${endpoint}/${id}`;

    try {
      const response = await lastValueFrom(this.httpService.delete(url));
      return response.data;
    } catch (error: any) {
      console.error('Error en delete:', {
        url,
        error: error?.response?.data || error.message,
      });

      throw new HttpException(
        'Error al eliminar el recurso',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
