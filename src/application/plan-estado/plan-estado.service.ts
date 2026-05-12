import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { reemplazar, reemplazarCampoRol } from 'src/utils/campo.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { ParametrosService } from 'src/shared/services/parametros.service';

const { TIPO_PARAMETRO, ETIQUETAS_ROL } = environment;

@Injectable()
export class PlanEstadoService {
  private readonly estados: any[] = [];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosService: TercerosHelperService,
    private readonly parametrosService: ParametrosService,
  ) {}

  private normalizarQueryEstados(queryParams: any): any {
    if (!queryParams?.query) return queryParams;

    const queryStr: string = queryParams.query;
    const estadoIdRegex = /estado_id:([^\s,]+)/;
    const match = queryStr.match(estadoIdRegex);

    if (!match) return queryParams;

    const valores = match[1];
    if (!valores.includes('|')) return queryParams;

    const queryNormalizado = queryStr.replace(
      estadoIdRegex,
      `estado_id__in:${valores}`,
    );

    return { ...queryParams, query: queryNormalizado };
  }

  async getAll(queryParams: any) {
    const normalizedParams = this.normalizarQueryEstados(queryParams);
    const data = await this.auditoriaCrudService.traerDataCrud(
      'estado',
      null,
      normalizedParams,
    );
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    if (!id) {
      throw new BadRequestException('El id es requerido');
    }

    const data = await this.auditoriaCrudService.traerDataCrud(
      'estado',
      id,
      null,
    );

    if (data?.Data == null) {
      throw new NotFoundException(`No se encontró estado de plan con id ${id}`);
    }

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
        const queryParams = {
          query: `TipoParametroId:${TIPO_PARAMETRO.PLAN_ESTADO}`,
          fields: 'Id,Nombre',
          limit: 0,
        };
        const param = await this.parametrosService
          .get('parametro', null, queryParams)
          .then((data) => data.Data);
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
      const usuario = await this.tercerosService.getTerceroById(
        element.usuario_id,
      );
      element.usuario = {
        id: usuario.Id,
        nombre: usuario.NombreCompleto.replace(/(^|\s)\p{L}/gu, (letra) =>
          letra.toUpperCase(),
        ),
      };
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
