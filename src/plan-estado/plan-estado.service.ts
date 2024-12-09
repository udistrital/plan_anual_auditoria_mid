import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

@Injectable()
export class PlanEstadoService {
  private estados: any[] = [];
  private roles = {
    VICERRECTOR: 'Secretario',
    JEFE_DEPENDENCIA: 'Jefe',
    ADMIN_SGA: 'Auditor',
  };

  constructor(private readonly httpService: HttpService) {}

  async getAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    const data = await this.traerDataCrud(id, null);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;

      if ('estado_id' in firstElement) {
        let param = await this.traerParametros('138'); // Cambia "201" al ID correcto.
        this.estados.push(...param);
        validacion = true;
      }

      return validacion;
    } catch (error) {
      console.error(error);
    }
  }

  private async traerParametros(idParam: string) {
    const apiUrl = `${environment.PARAMETROS_SERVICE}`;
    const url = `${apiUrl}/parametro?query=TipoParametroId:${idParam}&fields=Id,Nombre`;
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
            this.reemplazar(this.estados, element, 'estado_id', 'estado');
          }
          if (element.usuario_rol !== undefined) {
            this.reemplazarCampoRol(element);
          }
          if (element.usuario_id !== undefined) {
            await this.reemplazarCampoUsuario(element);
            console.log(element);
          }
        }),
      );
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.estado_id !== undefined) {
        this.reemplazar(this.estados, data.Data, 'estado_id', 'estado');
      }
      if (data.Data.usuario_rol !== undefined) {
        this.reemplazarCampoRol(data.Data);
      }
      if (data.Data.usuario_id !== undefined) {
        await this.reemplazarCampoUsuario(data.Data);
      }
    }
    return data;
  }

  private reemplazar(
    array: any[],
    element: any,
    campo: string,
    campoNuevo: string,
  ) {
    const value = element[campo];

    if (Array.isArray(value)) {
      element[campoNuevo] = value.map((id) => {
        const encontrado = array.find((param) => param.Id === id);
        return encontrado
          ? { id: id, nombre: encontrado.Nombre }
          : { id: id, nombre: null };
      });
    } else {
      const encontrado = array.find((param) => param.Id === value);
      if (encontrado) {
        element[campoNuevo] = { id: value, nombre: encontrado.Nombre };
      } else {
        console.warn(`No se encontró ${campo} para ID: ${value}`);
        element[campoNuevo] = { id: value, nombre: null };
      }
    }

    delete element[campo];

    return element;
  }

  private async traerDataCrud(id: string | null, queryParams: any) {
    const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
    let url = `${apiUrl}estado/`;

    if (id != null && id != undefined) {
      url = url + `${id}`;
    }
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
      );
    }
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
    const apiUrl = `${environment.TERCEROS_SERVICE}`;
    const url = `${apiUrl}/tercero/${idUsuario}`;

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

  private reemplazarCampoRol(element: any) {
    if (element.usuario_rol && this.roles[element.usuario_rol]) {
      element.usuario_rol = this.roles[element.usuario_rol];
    }
  }
}
