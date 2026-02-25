import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, forkJoin } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditorService } from '../../auditor/auditor.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { Dominio } from 'src/shared/utils/dominios/dominio.model';
import { unirListaNombresConComas } from 'src/utils/texto.utils';
import {
  ordenarAuditoriasPorPlan,
  aplicarOrdenamiento,
} from 'src/shared/utils/auditoria-ordenamiento.utils';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  PARAMETROS_SERVICE,
  TIPO_PARAMETRO,
  TERCEROS_SERVICE,
  OIKOS_SERVICE,
} = environment;

@Injectable()
export class AuditoriaService {
  private tiposEvaluacion: any[] = [];
  private cronogramasActividad: any[] = [];
  private macroprocesos: any[] = [];
  private procesos: any[] = [];
  private dependencias: any[] = [];
  private lideres: any[] = [];
  private responsables: any[] = [];
  private vigencias: any[] = [];
  private correos: any = {};
  private estados: { Id: number; Nombre: string }[] = [
    { Id: 1, Nombre: 'Activo' },
    { Id: 2, Nombre: 'Inactivo' },
    { Id: 3, Nombre: 'Otro' },
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly auditorService: AuditorService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
    await Promise.all(
      data.Data.map(async (auditoria: any) => {
        const [estado, auditores] = await Promise.all([
          this.getEstadoAuditoria(auditoria._id),
          this.asociarAuditores(auditoria._id),
        ]);

        if (estado?.actual) {
          auditoria.estado = estado;
          auditoria.estado_id = estado.estado_id;
        }
        auditoria.auditores = auditores || [];
      }),
    );
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByAuditor(personaId: string, queryParams: any) {
    const { estado_id, ...crudParams } = queryParams;

    if (crudParams.query) {
      crudParams.query = crudParams.query
        .split(',')
        .filter((param: string) => !param.startsWith('estado_id:'))
        .join(',');
    }

    const data = await this.traerDataCrudByAuditor(personaId, crudParams);

    await Promise.all(
      data.Data.map(async (auditoria: any) => {
        const [estado, auditores] = await Promise.all([
          this.getEstadoAuditoria(auditoria._id),
          this.asociarAuditores(auditoria._id),
        ]);

        if (estado?.actual) {
          auditoria.estado = estado;
          auditoria.estado_id = estado.estado_id;
        }
        auditoria.auditores = auditores || [];
      }),
    );

    if (estado_id && estado_id !== '') {
      const estadoId = parseInt(estado_id);
      data.Data = data.Data.filter(
        (auditoria: any) => auditoria.estado_id === estadoId,
      );
      data.MetaData.Count = data.Data.length;
    }

    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByDependencia(personaId: number, cargoId: number, queryParams: any) {
    const dependenciaIds = await this.getDependenciasByPersona(
      personaId,
      cargoId,
    );

    if (!dependenciaIds || dependenciaIds.length === 0) {
      return {
        Success: true,
        Status: 200,
        Message: 'Sin auditorías para las dependencias del usuario',
        Data: [],
        MetaData: { Count: 0 },
      };
    }

    const dependenciasFilter = dependenciaIds.join('|');
    const baseQuery = queryParams.query || '';

    const additionalFilters = `dependencia_id__in:${dependenciasFilter}`;
    queryParams.query = baseQuery
      ? `${baseQuery},${additionalFilters}`
      : additionalFilters;

    const data = await this.traerDataCrud(null, queryParams);
    if (data.Data && Array.isArray(data.Data) && data.Data.length > 0) {
      const dependenciaNombres =
        await this.getDependenciaNombres(dependenciaIds);

      await Promise.all(
        data.Data.map(async (auditoria: any) => {
          const estado = await this.getEstadoAuditoria(auditoria._id);

          if (estado?.actual) {
            auditoria.estado = estado;
            auditoria.estado_id = estado.estado_id;
          }
          auditoria.dependencia_nombre =
            dependenciaNombres.get(auditoria.dependencia_id) || null;
        }),
      );

      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }
    }

    return data;
  }

  private async getDependenciasByPersona(
    personaId: number,
    cargoId: number,
  ): Promise<number[]> {
    const url = `${TERCEROS_SERVICE}vinculacion?query=TerceroPrincipalId:${personaId},Activo:true,CargoId:${cargoId}&fields=DependenciaId`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));

      if (!response.data || response.data.length === 0) {
        return [];
      }
      return response.data
        .map((v: any) => v.DependenciaId)
        .filter((id: any) => id != null);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las dependencias del usuario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getDependenciaNombres(
    dependenciaIds: number[],
  ): Promise<Map<number, string>> {
    const nombresMap = new Map<number, string>();
    await Promise.all(
      dependenciaIds.map(async (id) => {
        try {
          const url = `${OIKOS_SERVICE}dependencia/${id}`;
          const response = await lastValueFrom(this.httpService.get(url));
          if (response.data?.Nombre) {
            nombresMap.set(id, response.data.Nombre);
          }
        } catch (error) {
          // Si no se puede obtener el nombre, se omite
        }
      }),
    );
    return nombresMap;
  }

  async getOne(id: string) {
    const data = await this.traerDataCrud(id, null);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getEmails(dependencia_id: number) {
    const correo_lider = await this.traerCorreoTerceroVinculado(
      dependencia_id,
      environment.CARGO.JEFE_DEPENDENCIA_ID,
    );

    const correo_responsable = await this.traerCorreoTerceroVinculado(
      dependencia_id,
      environment.CARGO.ASISTENTE_DEPENDENCIA_ID,
    );

    const correo_dependencia = this.traerCorreoDependencia(dependencia_id);
    return {
      correo_lider: correo_lider,
      correo_responsable: correo_responsable,
      correo_dependencia: correo_dependencia,
    };
  }

  async traerCorreoTerceroVinculado(
    dependenciaId: number,
    cargoId: number,
  ): Promise<string> {
    const url = `${TERCEROS_SERVICE}vinculacion?query=Activo:true,DependenciaId:${dependenciaId},CargoId:${cargoId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const vinculacion = response.data[0];
      return (
        vinculacion?.TerceroPrincipalId?.UsuarioWSO2 || 'Correo no encontrado'
      );
    } catch (error) {
      throw new HttpException(
        'Error al traer el tercero vinculado',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  traerCorreoDependencia(dependenciaId: number): string {
    const dependencia = this.dependencias.find(
      (dep) => dep.Id === dependenciaId,
    );
    return dependencia ? dependencia.CorreoElectronico : 'Correo no encontrado';
  }

  async getAuditoriasOrdenadas(queryParams: any) {
    const planId = this.extraerPlanId(queryParams);

    const crudParams = { ...queryParams };
    if (!crudParams.query) {
      crudParams.query = `plan_auditoria_id:${planId}`;
    } else if (!crudParams.query.includes('plan_auditoria_id')) {
      crudParams.query += `,plan_auditoria_id:${planId}`;
    }

    const data = await this.traerDataCrud(null, crudParams);

    if (data.Data && Array.isArray(data.Data)) {
      const auditoriasActivas = data.Data.filter(
        (auditoria) => auditoria.activo === true,
      );

      await Promise.all(
        auditoriasActivas.map(async (auditoria: any) => {
          const estado = await this.getEstadoAuditoria(auditoria._id);
          if (estado?.actual) {
            auditoria.estado_id = estado.estado_id;
          }
        }),
      );

      const planData = await this.obtenerPlanPorId(planId);
      data.Data = ordenarAuditoriasPorPlan(
        auditoriasActivas,
        planData?.auditorias || [],
      );

      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }

      if (queryParams.orderBy) {
        data.Data = aplicarOrdenamiento(
          data.Data,
          queryParams.orderBy,
          queryParams.orderDirection,
        );
      }
    }
    return data;
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

  private async obtenerPlanPorId(planId: string) {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener el plan',
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
        tipoParametro: TIPO_PARAMETRO.AUDITORIA_ESTADO,
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
        campo: 'lider_id',
        tipoParametro: TIPO_PARAMETRO.CARGO_LIDER,
        destino: this.lideres,
      },
      {
        campo: 'responsable_id',
        tipoParametro: TIPO_PARAMETRO.CARGO_RESPONSABLE,
        destino: this.responsables,
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
      this.correos = await this.getEmails(firstElement.dependencia_id);
    }

    return true;
  }

  private async traerDataCrud(id: string | null, queryParams: any) {
    let url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/`;
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

  private async traerDataCrudByAuditor(personaId: string, queryParams: any) {
    let url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/auditor/${personaId}`;
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

  private async getEstadoAuditoria(auditoriaId: string) {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria-estado?query=auditoria_id:${auditoriaId},actual:true`;
    try {
      const { data } = await lastValueFrom(this.httpService.get(url));
      if (data?.Data?.length > 0) {
        return data.Data[0];
      }
      return null;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del estado',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
        if (element.lider_id !== undefined) {
          this.reemplazar(this.lideres, element, 'lider_id');
        }
        if (element.responsable_id !== undefined) {
          this.reemplazar(this.responsables, element, 'responsable_id');
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
      if (data.Data.lider_id !== undefined) {
        this.reemplazar(this.lideres, data.Data, 'lider_id');
      }
      if (data.Data.responsable_id !== undefined) {
        this.reemplazar(this.responsables, data.Data, 'responsable_id');
      }
      if (data.Data.dependencia_id !== undefined) {
        data.Data = { ...data.Data, ...this.correos };
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

  private async asociarAuditores(idAuditor: string) {
    const query = {
      auditoria_id: idAuditor,
      activo: true,
    };
    const queryString = Object.entries(query)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    const queryParam = {
      query: queryString,
      limit: 0,
      fields: '_id,auditor_lider,auditor_id,asignado_por_id',
    };
    const auditoresAuditoria = await this.auditorService.getAll(queryParam);
    return auditoresAuditoria.Data;
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
