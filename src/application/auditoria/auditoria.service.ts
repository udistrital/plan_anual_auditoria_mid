import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, forkJoin } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditorService } from '../../auditor/auditor.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { Dominio } from 'src/shared/utils/dominios/dominio.model';
import { unirListaNombresConComas } from 'src/utils/texto.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  TIPO_PARAMETRO,
  TERCEROS_SERVICE,
} = environment;

@Injectable()
export class AuditoriaService {
  private tiposEvaluacion: any[] = [];
  private cronogramasActividad: any[] = [];
  private macroprocesos: any[] = [];
  private procesos: any[] = [];
  private dependencias: any[] = [];
  private vigencias: any[] = [];
  private datosTerceros: any = {};
  private estados: { Id: number; Nombre: string }[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly auditorService: AuditorService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    const queryEstado = queryParams.query
        .split(',')
        .filter((param: string) => param.startsWith('estado_id:'))[0]
    
    if (queryParams.query) {
      queryParams.query = queryParams.query
        .split(',')
        .filter((param: string) => !param.startsWith('estado_id:'))
        .join(',');
    }

    const queryPadre = {
      query: queryParams.query,
      limit: 0,
      fields: '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id'
    }

    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', null, queryPadre);
    const auditoriasPadre: any[] = data.Data;
    if (auditoriasPadre.length > 0) {
      const padresIds: string[] = auditoriasPadre.map(auditoria => auditoria?._id);
      
      const nuevaQuery = queryEstado ? 
        `${queryEstado},activo:true,auditoria_padre_id__in:${padresIds.join('|')}` :
        `activo:true,auditoria_padre_id__in:${padresIds.join('|')}`;

      const queryHijas = { ...queryParams, query: nuevaQuery }
      console.log(queryHijas)
      
      const data2 = await this.auditoriaCrudService.traerDataCrud('auditoria', null, queryHijas);
      const auditorias: any[] = data2.Data;
      
      const padresMap = Object.fromEntries(auditoriasPadre.map(p => [p?._id, p]));
      const auditorias_unidas: any[] = auditorias.map(a => {
        if (a?.auditoria_padre_id in padresMap) {
          return {
            ...(padresMap[a?.auditoria_padre_id] || {}),
            ...a,
          };
        }
      });
      
      data.Data = auditorias_unidas;
      data.MetaData.Count = auditorias_unidas.length;
    }
    

    await this.enriquecerAuditorias(data.Data);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByAuditor(personaId: string, queryParams: any) {
    if (queryParams.query) {
      queryParams.query = queryParams.query
        .split(',')
        .filter((param: string) => !param.startsWith('estado_id:'))
        .join(',');
    }

    const data = await this.auditoriaCrudService.traerDataCrud('auditoria/auditor', personaId, queryParams);
    const auditorias: any[] = data.Data;

    if (auditorias.length > 0) {
      const padres_ids: string[] = Array.from(new Set(auditorias.map(a => a?.auditoria_padre_id).filter(Boolean)));

      let padreQueryStr = `_id__in:${padres_ids.join('|')}`;
      if (queryParams.query) {
        padreQueryStr = `${queryParams.query},${padreQueryStr}`;
      }

      const queryPadre = {
        query: padreQueryStr,
        limit: 0,
        fields: '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id',
      };

      const data2 = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', null, queryPadre);
      const auditorias_padre: any[] = data2.Data;

      const padresMap = Object.fromEntries(auditorias_padre.map(p => [p?._id, p]));
      const auditorias_unidas: any[] = auditorias.map(a => {
        if (a?.auditoria_padre_id in padresMap) {
          return {
            ...(padresMap[a?.auditoria_padre_id] || {}),
            ...a,
          };
        }
        return a;
      });

      data.Data = auditorias_unidas;
      data.MetaData.Count = auditorias_unidas.length;
    }
    
    await this.enriquecerAuditorias(data.Data);

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

    const queryEstado = queryParams.query
      ? queryParams.query.split(',').filter((param: string) => param.startsWith('estado_id:'))[0]
      : undefined;

    const queryPadreBase = queryParams.query
      ? queryParams.query.split(',').filter((param: string) => !param.startsWith('estado_id:')).join(',')
      : '';

    const additionalFilters = `dependencia_id__in:${dependenciasFilter}`;
    const queryPadreString = queryPadreBase ? `${queryPadreBase},${additionalFilters}` : additionalFilters;

    // incluir tipo_evaluacion_id si viene en queryParams.query original
    const tipoEvalParam = queryParams.query
      ? queryParams.query.split(',').filter((param: string) => param.startsWith('tipo_evaluacion_id:'))[0]
      : undefined;

    let queryPadreFinal = queryPadreString;
    if (tipoEvalParam) {
      queryPadreFinal = `${tipoEvalParam},${queryPadreFinal}`;
    }

    const queryPadre = {
      query: queryPadreFinal,
      limit: 0,
      fields: '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id',
    };

    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', null, queryPadre);
    const auditorias: any[] = data.Data;

    if (auditorias.length > 0) {
      const ids: string[] = auditorias.map(a => a?._id);

      // construir query de hijas incluyendo estado (si aplica) y tipo_evaluacion (si aplica)
      const tipoEvalHija = tipoEvalParam ? tipoEvalParam : undefined;
      const nuevaQueryParts = [] as string[];
      if (tipoEvalHija) nuevaQueryParts.push(tipoEvalHija);
      if (queryEstado) nuevaQueryParts.push(queryEstado);
      nuevaQueryParts.push('activo:true');
      nuevaQueryParts.push(`auditoria_padre_id__in:${ids.join('|')}`);

      const nuevaQuery = nuevaQueryParts.join(',');

      const queryHijas = { ...queryParams, query: nuevaQuery };
      const data2 = await this.auditoriaCrudService.traerDataCrud('auditoria', null, queryHijas);
      const auditorias_hijas: any[] = data2.Data;

      const padresMap = Object.fromEntries(auditorias.map(p => [p?._id, p]));
      const auditorias_unidas: any[] = auditorias_hijas.map(a => {
        if (a?.auditoria_padre_id in padresMap) {
          return {
            ...(padresMap[a?.auditoria_padre_id] || {}),
            ...a,
          };
        }
        return a;
      });

      data.Data = auditorias_unidas;
      data.MetaData.Count = auditorias_unidas.length;
    }
    

    if (data.Data && Array.isArray(data.Data) && data.Data.length > 0) {
      const dependenciaNombres =
        await this.getDependenciaNombres(dependenciaIds);

      await this.enriquecerAuditorias(data.Data, false);

      data.Data.forEach((auditoria: any) => {
        auditoria.dependencia_nombre =
          dependenciaNombres.get(auditoria.dependencia_id) || null;
      });

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
    const dependencias = await lastValueFrom(
      this.dominiosService.getDependencias()
    );

    const nombresMap = new Map<number, string>();
    dependenciaIds.forEach(id => {
      const dep = dependencias.parametros.find(d => d.Id === id);
      if (dep?.Nombre) {
        nombresMap.set(id, dep.Nombre);
      }
    });

    return nombresMap;
  }

  async getOne(id: string) {
    const auditoria = await this.auditoriaCrudService.traerDataCrud('auditoria', id, null);
    const auditoria_padre = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', auditoria.Data.auditoria_padre_id, null);
    const data = { ...auditoria, Data: {...auditoria_padre.Data, ...auditoria.Data}};
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getDatosTerceros(dependencia_id: number) {
    const jefe_dependencia = await this.traerTerceroVinculado(
      dependencia_id,
      environment.CARGO.JEFE_DEPENDENCIA_ID,
    );

    const asistente_dependencia = await this.traerTerceroVinculado(
      dependencia_id,
      environment.CARGO.ASISTENTE_DEPENDENCIA_ID,
    );

    return {
      jefe_nombre: jefe_dependencia?.NombreCompleto,
      jefe_correo: jefe_dependencia?.UsuarioWSO2,
      asistente_nombre: asistente_dependencia?.NombreCompleto,
      asistente_correo: asistente_dependencia?.usuarioWSO2,
    };
  }

  async traerTerceroVinculado(
    dependenciaId: number,
    cargoId: number,
  ): Promise<any> {
    const url = `${TERCEROS_SERVICE}vinculacion?order=desc&sortby=Id&fields=TerceroPrincipalId&`
      +`query=Activo:true,DependenciaId:${dependenciaId},CargoId:${cargoId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data[0]?.TerceroPrincipalId;
    } catch (error) {
      throw new HttpException(
        'Error al traer el tercero vinculado',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  private async enriquecerAuditorias(auditorias: any[], incluirAuditores = true) {
    await Promise.all(
      auditorias.map(async (auditoria) => {
        const queryParams = { query: `auditoria_id:${auditoria._id},actual:true`}
        const promises = [this. auditoriaCrudService.traerDataCrud('auditoria-estado', null, queryParams)];
        if (incluirAuditores) promises.push(this.asociarAuditores(auditoria._id));

        const [estado, auditores] = await Promise.all(promises);

        if (estado.Data[0]?.actual) {
          auditoria.estado = estado.Data[0];
          auditoria.estado_id = estado.Data[0]?.estado_id;
        }
        if (incluirAuditores) auditoria.auditores = auditores || [];
      })
    );
  }

  private traerCorreoDependencia(dependenciaId: number): string {
    const dependencia = this.dependencias.find(
      (dep) => dep.Id === dependenciaId
    );
    return dependencia ? dependencia.CorreoElectronico : 'Correo no encontrado';
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
      if (!Array.isArray(data.Data)) {
        this.datosTerceros = await this.getDatosTerceros(firstElement.dependencia_id);
      }
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
        data.Data = {
          ...data.Data,
          ...this.datosTerceros,
          ...{correo_dependencia: this.traerCorreoDependencia(data.Data.dependencia_id)}
        };
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

  async deleteAuditoria(auditoriaId: string, planAuditoriaId: string) {
    if (!planAuditoriaId) {
      throw new HttpException(
        'El parámetro "plan_auditoria_id" es obligatorio.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // 1. Eliminar lógicamente la auditoría
      const deleteUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/${auditoriaId}`;
      await lastValueFrom(this.httpService.delete(deleteUrl));

      // 2. Obtener el plan de auditoría actual
      const getPlanUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planAuditoriaId}`;
      const planResponse = await lastValueFrom(this.httpService.get(getPlanUrl));
      const plan = planResponse.data.Data;

      // 3. Filtrar las auditorías para eliminar la auditoría borrada
      const auditoriasActualizadas = plan.auditorias.filter(
        (id: string) => id !== auditoriaId,
      );

      // 4. Actualizar el plan de auditoría
      const putPlanUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planAuditoriaId}`;
      await lastValueFrom(
        this.httpService.put(putPlanUrl, { auditorias: auditoriasActualizadas }),
      );

      return {
        Success: true,
        Status: 200,
        Message: 'Auditoría eliminada exitosamente',
        Data: null,
      };
    } catch (error) {
      throw new HttpException(
        error.response?.data?.message || 'Error al eliminar la auditoría',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
