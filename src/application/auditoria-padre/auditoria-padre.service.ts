import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, forkJoin } from 'rxjs';
import { environment } from 'src/config/configuration';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { Dominio } from 'src/shared/utils/dominios/dominio.model';
import { unirListaNombresConComas } from 'src/utils/texto.utils';
import { AuditoriaOrdenadaService } from 'src/shared/services/auditoria-ordenada/auditoria-ordenada.service';
import { aplicarOrdenamiento } from '../../shared/utils/auditoria-ordenamiento.utils';

const { PLAN_AUDITORIA_CRUD_SERVICE, TIPO_PARAMETRO } = environment;

@Injectable()
export class AuditoriaPadreService {
  private tiposEvaluacion: any[] = [];
  private cronogramasActividad: any[] = [];
  private macroprocesos: any[] = [];
  private procesos: any[] = [];
  private dependencias: any[] = [];
  private vigencias: any[] = [];
  private estados: { Id: number; Nombre: string }[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly dominiosService: DominiosService,
    private readonly auditoriaOrdenadaService: AuditoriaOrdenadaService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
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

  async getAuditoriasOrdenadas(queryParams: any) {
    const planId = this.extraerPlanId(queryParams);

    const filtros: any = {};
    if (queryParams.query) {
      const queryParts = queryParams.query.split(',');
      queryParts.forEach((part: string) => {
        if (part.startsWith('tipo_evaluacion_id:')) {
          filtros.tipo_evaluacion_id = part.split(':')[1];
        }
      });
    }
    if (queryParams.tipo_evaluacion_id) {
      filtros.tipo_evaluacion_id = queryParams.tipo_evaluacion_id;
    }

    const auditoriasOrdenadas = await this.auditoriaOrdenadaService.getAuditoriasOrdenadas(
      planId,
      undefined,
      undefined,
      filtros,
      'auditoria-padre',
    );

    const data = {
      Data: auditoriasOrdenadas,
      Success: true,
      Status: 200,
    };

    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }

    if (queryParams.orderBy) {
      data.Data = aplicarOrdenamiento(data.Data, queryParams.orderBy, queryParams.orderDirection);
    }

    return data;
  }

  async deleteAuditoriaPadre(auditoriaPadreId: string, planAuditoriaId: string) {
    if (!planAuditoriaId) {
      throw new HttpException(
        'El parámetro "plan_auditoria_id" es obligatorio.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const deleteUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria-padre/${auditoriaPadreId}`;
      await lastValueFrom(this.httpService.delete(deleteUrl));

      const getPlanUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planAuditoriaId}`;
      const planResponse = await lastValueFrom(this.httpService.get(getPlanUrl));
      const plan = planResponse.data.Data;

      const auditoriasPadreActualizadas = (plan.auditorias || []).filter(
        (id: string) => id !== auditoriaPadreId,
      );

      const putPlanUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planAuditoriaId}`;
      await lastValueFrom(
        this.httpService.put(putPlanUrl, { auditorias: auditoriasPadreActualizadas }),
      );

      return {
        Success: true,
        Status: 200,
        Message: 'Auditoría padre eliminada exitosamente',
        Data: null,
      };
    } catch (error) {
      throw new HttpException(
        error.response?.data?.message || 'Error al eliminar la auditoría padre',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private extraerPlanId(queryParams: any): string {
    if (queryParams.plan_auditoria_id) {
      return queryParams.plan_auditoria_id;
    }

    if (queryParams.query) {
      const match = queryParams.query.match(/plan_auditoria_id:([^,]+)/);
      if (match?.[1]) {
        return match[1];
      }
    }

    throw new HttpException(
      'El parámetro "plan_auditoria_id" es obligatorio.',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async traerDataCrud(id: string | null, queryParams: any) {
    let url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria-padre/`;
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

  private async identificarCampo(data: any) {
    const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;

    if (!firstElement) {
      return false;
    }

    const camposConfig = [
      {
        campo: 'tipo_evaluacion_id',
        tipoParametro: TIPO_PARAMETRO.TIPO_EVALUACION,
        destino: this.tiposEvaluacion,
      },
      {
        campo: 'cronograma_id',
        tipoParametro: TIPO_PARAMETRO.CRONOGRAMA,
        destino: this.cronogramasActividad,
      },
      {
        campo: 'estado_id',
        tipoParametro: TIPO_PARAMETRO.AUDITORIA_PADRE_ESTADO,
        destino: this.estados,
      },
      {
        campo: 'macroproceso_id',
        tipoParametro: TIPO_PARAMETRO.MACROPROCESO,
        destino: this.macroprocesos,
      },
      {
        campo: 'proceso_id',
        tipoParametro: TIPO_PARAMETRO.PROCESO,
        destino: this.procesos,
      },
      {
        campo: 'vigencia_id',
        tipoParametro: TIPO_PARAMETRO.VIGENCIA,
        destino: this.vigencias,
      },
    ];

    const observables: Record<string, any> = {};
    const camposPresentes = camposConfig.filter(
      (config) => config.campo in firstElement,
    );

    camposPresentes.forEach((config) => {
      observables[config.campo] = this.dominiosService.getParametros(
        config.tipoParametro,
      );
    });

    if ('dependencia_id' in firstElement) {
      observables['dependencia_id'] = this.dominiosService.getDependencias();
    }

    if (Object.keys(observables).length === 0) {
      return false;
    }

    const resultados = (await lastValueFrom(forkJoin(observables))) as Record<
      string,
      Dominio
    >;

    camposPresentes.forEach((config) => {
      if (resultados[config.campo]) {
        config.destino.push(...resultados[config.campo].parametros);
      }
    });

    if (resultados['dependencia_id']) {
      this.dependencias.push(...resultados['dependencia_id'].parametros);
    }

    return true;
  }

  private reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element) => {
        if (element.tipo_evaluacion_id !== undefined) {
          this.reemplazar(this.tiposEvaluacion, element, 'tipo_evaluacion_id');
        }
        if (element.cronograma_id !== undefined) {
          this.reemplazar(this.cronogramasActividad, element, 'cronograma_id');
        }
        if (element.estado_id !== undefined) {
          this.reemplazar(this.estados, element, 'estado_id');
        }
        if (element.macroproceso_id !== undefined) {
          this.reemplazar(this.macroprocesos, element, 'macroproceso_id');
        }
        if (element.vigencia_id !== undefined) {
          this.reemplazar(this.vigencias, element, 'vigencia_id');
        }
        if (element.proceso_id !== undefined) {
          this.reemplazar(this.procesos, element, 'proceso_id');
        }
        if (element.dependencia_id !== undefined) {
          this.reemplazar(this.dependencias, element, 'dependencia_id');
        }

        element.cronograma = this.unirCronogramaNombres(
          element.cronograma_nombre,
        );
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.tipo_evaluacion_id !== undefined) {
        this.reemplazar(this.tiposEvaluacion, data.Data, 'tipo_evaluacion_id');
      }
      if (data.Data.cronograma_id !== undefined) {
        this.reemplazar(this.cronogramasActividad, data.Data, 'cronograma_id');
      }
      if (data.Data.estado_id !== undefined) {
        this.reemplazar(this.estados, data.Data, 'estado_id');
      }
      if (data.Data.macroproceso_id !== undefined) {
        this.reemplazar(this.macroprocesos, data.Data, 'macroproceso_id');
      }
      if (data.Data.vigencia_id !== undefined) {
        this.reemplazar(this.vigencias, data.Data, 'vigencia_id');
      }
      if (data.Data.proceso_id !== undefined) {
        this.reemplazar(this.procesos, data.Data, 'proceso_id');
      }
      if (data.Data.dependencia_id !== undefined) {
        this.reemplazar(this.dependencias, data.Data, 'dependencia_id');
      }
    }
    return data;
  }

  private reemplazar(array: any[], element: any, campo: string) {
    const value = element[campo];

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
      element[nuevoCampo] = encontrado ? encontrado.Nombre : null;
    }
    return element;
  }

  private unirCronogramaNombres(cronograma_nombre: any[]) {
    if (Array.isArray(cronograma_nombre) && cronograma_nombre.length === 12) {
      const mesesCompletos = [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
      ];
      const tieneLosMeses = mesesCompletos.every((mes) =>
        cronograma_nombre.some((nombre) => nombre === mes),
      );
      if (tieneLosMeses) {
        return 'Todos';
      }
    }
    return unirListaNombresConComas(cronograma_nombre);
  }
}
