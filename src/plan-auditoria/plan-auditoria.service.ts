import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros/terceros-helper.service';
import { ParametrosService } from 'src/shared/services/parametros/parametros.service';

const {
  TIPO_PARAMETRO,
  PLAN_ESTADO,
  AUDITORIA_PADRE_ESTADO,
} = environment;

@Injectable()
export class PlanAuditoriaService {
  private vigencias: any[] = [];
  private estados: any[] = [];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosService: TercerosHelperService,
    private readonly parametrosService: ParametrosService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud('plan-auditoria', null, queryParams);
    await this.enriquecerPlan(data.Data)
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    const data = await this.auditoriaCrudService.traerDataCrud('plan-auditoria', id, null);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
      const queryParams = {
        query: ``,
        fields: 'Id,Nombre',
        limit: 0,
      }
      if ('vigencia_id' in firstElement) {
        const query = { ...queryParams, query: `TipoParametroId:${TIPO_PARAMETRO.VIGENCIA}` }
        const param = await this.parametrosService.get('parametro', null, query).then(data => data.Data);
        this.vigencias.push(...param);
        validacion = true;
      }
      if ('estado' in firstElement && firstElement.estado !== null) {
        const estadoId = firstElement.estado.estado_id;
        if (estadoId) {
          const query = { ...queryParams, query: `TipoParametroId:${TIPO_PARAMETRO.PLAN_ESTADO}` }
          const estado = await this.parametrosService.get('parametro', null, query).then(data => data.Data);
          this.estados.push(...estado);
        }
        validacion = true;
      }
      return validacion;
    } catch (error) {
      console.warn('Error en identificarCampo:', error);
    }
  }

  private async enriquecerPlan(Data: any) {
    if (Array.isArray(Data)) {
      await Promise.all(
        Data.map(async (plan: any) => {
          const [estado, tieneRechazos, tieneModificaciones, tercero] = await Promise.all([
            this.traerEstadoPorPlan(plan._id),
            this.traerMotivosRechazo(plan._id, PLAN_ESTADO.RECHAZADO),
            this.tieneModificaciones(plan.auditorias),
            plan.creado_por_id ? this.tercerosService.getTerceroById(plan.creado_por_id) : null,
          ]);

          if (estado?.actual) plan.estado = estado;
          plan.tiene_rechazos = tieneRechazos;
          plan.tiene_modificaciones = tieneModificaciones;
          if (tercero) plan.creado_por_nombre = tercero.NombreCompleto ?? null;
        }),
      );
    } else if (Data && Data._id) {
      const estado = await this.traerEstadoPorPlan(Data._id);
      if (estado && estado.actual) {
        Data.estado = estado;
      }
    }
  }

  private async traerMotivosRechazo(planAuditoriaId: string, estadoId: number) {
    const queryParams = {
      query: `plan_auditoria_id:${planAuditoriaId},estado_id:${estadoId},activo:true`,
      limit: 1,
      fields: '_id',
    }
    const data = await this.auditoriaCrudService.traerDataCrud('estado', null, queryParams);
    return data?.MetaData?.Count > 0;
  }

  private async tieneModificaciones(auditorias: string[]): Promise<boolean> {
    const queryParams: any = {
      query: `estado_id:${AUDITORIA_PADRE_ESTADO.CON_MODIFICACION_EXTEMPORANEA_ID},auditoria_padre_id__in:${auditorias.join('|')}`,
      limit: 0,
      fields: '_id',
    }
    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-padre-estado', null, queryParams);
    return data?.MetaData?.Count > 0;
  }

  private async traerEstadoPorPlan(planAuditoriaId: string) {
    const queryParams = {
      query: `plan_auditoria_id:${planAuditoriaId},actual:true`,
    }
    const data = await this.auditoriaCrudService.traerDataCrud('estado', null, queryParams);
    if ( data && data.Data && data.Data.length > 0 ) {
      return data.Data[0];
    }
    return null;
  }

  private reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element) => {
        if (element.vigencia_id !== undefined) {
          this.reemplazar(this.vigencias, element, 'vigencia_id');
        }
        if (element.estado && element.estado.estado_id !== undefined) {
          this.reemplazar(this.estados, element.estado, 'estado_id');
        }
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.vigencia_id !== undefined) {
        this.reemplazar(this.vigencias, data.Data, 'vigencia_id');
      }
      if (data.Data.estado && data.Data.estado.estado_id !== undefined) {
        this.reemplazar(this.estados, data.Data.estado, 'estado_id');
      }
    }
    return data;
  }

  private reemplazar(array: any[], element: any, campo: string) {
    const value = element[campo];

    //se realiza reemplazo de sufijo _id si existe, por _nombre
    const nuevoCampo = campo.endsWith('_id')
      ? campo.replace('_id', '_nombre')
      : `${campo}_nombre`;

    if (Array.isArray(value)) {
      element[nuevoCampo] = value.map((id) => {
        const encontrado = array.find((param) => param.Id === id);
        return encontrado ? encontrado.Nombre : id;
      });
    } else {
      const encontrado = array.find((param) => param.Id === value);
      if (encontrado) {
        element[nuevoCampo] = encontrado.Nombre;
      } else {
        console.warn(`No se encontró ${campo} para ID: ${value}`);
        element[nuevoCampo] = null;
      }
    }
    return element;
  }
}
