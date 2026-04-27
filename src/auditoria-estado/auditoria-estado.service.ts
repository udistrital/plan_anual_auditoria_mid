import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { environment as env } from 'src/config/configuration';
import { reemplazar, reemplazarCampoRol } from 'src/utils/campo.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';

@Injectable()
export class AuditoriaEstadoService {
  private estados: any[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly auditoriaCrudService: AuditoriaCrudService
  ) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-estado', null, queryParams);
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-estado', id, null);
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
    return data;
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
      if ('estado_id' in firstElement) {
        const param = await this.traerParametros(env().TIPO_PARAMETRO.AUDITORIA_ESTADO);
        this.estados.push(...param);
        validacion = true;
      }
      return validacion;
    } catch (error) {
      console.error(error);
    }
  }

  private async traerParametros(idParam: number) {
    const url = `${env().PARAMETROS_SERVICE}/parametro?query=TipoParametroId:${idParam}&fields=Id,Nombre`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      await Promise.all(
        data.Data.map(async (element) => {
          if (element.estado_id !== undefined) {
            reemplazar(this.estados, element, 'estado_id', 'estado');
          }
          if (element.usuario_rol !== undefined) {
            reemplazarCampoRol(element, env().ETIQUETAS_ROL);
          }
          if (element.usuario_id !== undefined) {
            await this.reemplazarCampoUsuario(element);
          }
        }),
      );
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.estado_id !== undefined) {
        reemplazar(this.estados, data.Data, 'estado_id', 'estado');
      }
      if (data.Data.usuario_rol !== undefined) {
        reemplazarCampoRol(data.Data, env().ETIQUETAS_ROL);
      }
      if (data.Data.usuario_id !== undefined) {
        await this.reemplazarCampoUsuario(data.Data);
      }
    }
    return data;
  }

  private async reemplazarCampoUsuario(element: any) {
    try {
      const usuario = await this.traerUsuario(element.usuario_id);
      element.usuario = usuario;
      delete element.usuario_id;
    } catch (error) {
      console.warn(
        `Error al reemplazar usuario para ID: ${element.usuario_id}`,
        error,
      );
      element.usuario = { id: element.usuario_id, nombre: null };
      delete element.usuario_id;
    }
  }

  private async traerUsuario(idUsuario: string) {
    const url = `${env().TERCEROS_SERVICE}/tercero/${idUsuario}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const data = response.data;
      return {
        id: data.Id,
        nombre: data.NombreCompleto.replace(/(^|\s)\p{L}/gu, (letra) =>
          letra.toUpperCase(),
        ),
      };
    } catch (error) {
      console.warn(`No se pudo obtener el usuario con ID: ${idUsuario}`, error);
      return { id: idUsuario, nombre: null };
    }
  }
}
