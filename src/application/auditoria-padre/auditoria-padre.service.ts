import { Injectable, HttpException, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { lastValueFrom, forkJoin } from 'rxjs';
import { environment } from 'src/config/configuration';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { Dominio } from 'src/shared/utils/dominios/dominio.model';
import { unirListaNombresConComas } from 'src/utils/texto.utils';
import { AuditoriaOrdenadaService } from 'src/shared/services/auditoria-ordenada.service';
import { aplicarOrdenamiento } from '../../shared/utils/auditoria-ordenamiento.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';

const { TIPO_PARAMETRO } = environment;

@Injectable()
export class AuditoriaPadreService {
  private readonly tiposEvaluacion: any[] = [];
  private readonly cronogramasActividad: any[] = [];
  private readonly macroprocesos: any[] = [];
  private readonly procesos: any[] = [];
  private readonly dependencias: any[] = [];
  private readonly vigencias: any[] = [];
  private readonly estados: { Id: number; Nombre: string }[] = [];

  constructor(
    private readonly dominiosService: DominiosService,
    private readonly auditoriaOrdenadaService: AuditoriaOrdenadaService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
  ) {}
  
  async getAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
  
    if (!data?.Data || data.Data.length === 0) {
      throw new NotFoundException('No se encontraron auditorías padre');
    }
  
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
  
    return data;
  }

  async getOne(id: string) {
    if (!id) {
      throw new BadRequestException('El id es obligatorio');
    }
  
    const data = await this.traerDataCrud(id, null);
  
    if (!data?.Data) {
      throw new NotFoundException(
        `Auditoría padre con id ${id} no encontrada`,
      );
    }
  
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
  
    return data;
  }

  async getAuditoriasOrdenadas(queryParams: any) {
    const planId = this.extraerPlanId(queryParams);
  
    if (!planId) {
      throw new BadRequestException(
        'El parámetro "plan_auditoria_id" es obligatorio',
      );
    }
  
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
  
    const auditoriasOrdenadas =
      await this.auditoriaOrdenadaService.getAuditoriasOrdenadas(
        planId,
        undefined,
        undefined,
        filtros,
        'auditoria-padre',
      );
  
    const data = {
      Data: auditoriasOrdenadas || [],
    };
  
    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }
  
    if (queryParams.orderBy) {
      data.Data = aplicarOrdenamiento(
        data.Data,
        queryParams.orderBy,
        queryParams.orderDirection,
      );
    }
  
    return data;
  }

  async deleteAuditoriaPadre(
    auditoriaPadreId: string,
    planAuditoriaId: string,
  ) {
    if (!auditoriaPadreId) {
      throw new BadRequestException(
        'El parámetro "auditoriaPadreId" es obligatorio',
      );
    }

    if (!planAuditoriaId) {
      throw new BadRequestException(
        'El parámetro "planAuditoriaId" es obligatorio',
      );
    }

    // 1. obtener plan primero
    const planResponse =
      await this.auditoriaCrudService.traerDataCrud(
        'plan-auditoria',
        planAuditoriaId,
        null,
      );

    const plan = planResponse?.Data;

    if (!plan) {
      throw new NotFoundException(
        `Plan ${planAuditoriaId} no encontrado`,
      );
    }

    const auditorias = Array.isArray(plan.auditorias)
      ? plan.auditorias
      : [];

    if (!auditorias.includes(auditoriaPadreId)) {
      throw new NotFoundException(
        `La auditoría padre ${auditoriaPadreId} no pertenece al plan`,
      );
    }

    // 2. actualizar plan
    const auditoriasActualizadas = auditorias.filter(
      (id: string) => id !== auditoriaPadreId,
    );

    await this.auditoriaCrudService.put(
      'plan-auditoria',
      planAuditoriaId,
      {
        auditorias: auditoriasActualizadas,
      },
    );

    // 3. eliminar auditoría padre
    await this.auditoriaCrudService.delete(
      'auditoria-padre',
      auditoriaPadreId,
    );

    return {
      message: 'Auditoría padre eliminada exitosamente',
    };
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

  private async traerDataCrud(
    id: string | null,
    queryParams: any,
  ) {
    return this.auditoriaCrudService.traerDataCrud(
      'auditoria-padre',
      id,
      queryParams,
    );
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
    const procesar = (element: any) => {
      if (element.tipo_evaluacion_id !== undefined)
        this.reemplazar(this.tiposEvaluacion, element, 'tipo_evaluacion_id');
      if (element.cronograma_id !== undefined)
        this.reemplazar(this.cronogramasActividad, element, 'cronograma_id');
      if (element.estado_id !== undefined)
        this.reemplazar(this.estados, element, 'estado_id');
      if (element.macroproceso_id !== undefined)
        this.reemplazar(this.macroprocesos, element, 'macroproceso_id');
      if (element.vigencia_id !== undefined)
        this.reemplazar(this.vigencias, element, 'vigencia_id');
      if (element.proceso_id !== undefined)
        this.reemplazar(this.procesos, element, 'proceso_id');
      if (element.dependencia_id !== undefined)
        this.reemplazar(this.dependencias, element, 'dependencia_id');

      const MESES = [
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
      element.cronograma = this.unirNombres(element.cronograma_nombre, MESES);
      element.macroproceso = this.unirNombres(element.macroproceso_nombre);
      element.proceso = this.unirNombres(element.proceso_nombre);
      element.dependencia = this.unirNombres(element.dependencia_nombre);
    };

    if (Array.isArray(data.Data)) {
      data.Data.forEach(procesar);
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      procesar(data.Data);
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

  private unirNombres(nombres: any[], todosSiCompletos?: string[]): string {
    if (!Array.isArray(nombres)) return nombres ?? null;
    if (
      todosSiCompletos?.length &&
      nombres.length === todosSiCompletos.length &&
      todosSiCompletos.every((n) => nombres.includes(n))
    ) {
      return 'Todos';
    }
    return unirListaNombresConComas(nombres);
  }
}
