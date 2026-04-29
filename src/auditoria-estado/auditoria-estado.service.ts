import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { reemplazar, reemplazarCampoRol } from 'src/utils/campo.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros/terceros-helper.service';
import { ParametrosService } from 'src/shared/services/parametros/parametros.service';

const {
  TIPO_PARAMETRO,
  ETIQUETAS_ROL,
} = environment;

@Injectable()
export class AuditoriaEstadoService {
  private estados: any[] = [];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosService: TercerosHelperService,
    private readonly parametrosService: ParametrosService,
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
        const queryParams = {
          query: `TipoParametroId:${TIPO_PARAMETRO.AUDITORIA_ESTADO}`,
          fields: 'Id,Nombre',
          limit: 0,
        }
        const param = await this.parametrosService.get('parametro', null, queryParams).then(data => data.Data);
        this.estados.push(...param);
        validacion = true;
      }
      return validacion;
    } catch (error) {
      console.error(error);
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
            reemplazarCampoRol(element, ETIQUETAS_ROL);
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
        reemplazarCampoRol(data.Data, ETIQUETAS_ROL);
      }
      if (data.Data.usuario_id !== undefined) {
        await this.reemplazarCampoUsuario(data.Data);
      }
    }
    return data;
  }

  private async reemplazarCampoUsuario(element: any) {
    try {
      const usuario = await this.tercerosService.getTerceroById(element.usuario_id);
      element.usuario = {
        id: usuario.Id,
        nombre: usuario.NombreCompleto.replace(/(^|\s)\p{L}/gu, (letra) =>
          letra.toUpperCase(),
        )};
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

}
