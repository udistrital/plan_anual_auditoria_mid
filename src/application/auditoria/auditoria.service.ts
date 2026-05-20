import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { lastValueFrom, forkJoin } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditorService } from '../auditor/auditor.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { Dominio } from 'src/shared/utils/dominios/dominio.model';
import { unirListaNombresConComas } from 'src/utils/texto.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';

const { TIPO_PARAMETRO } = environment;

@Injectable()
export class AuditoriaService {
  private readonly tiposEvaluacion: any[] = [];
  private readonly cronogramasActividad: any[] = [];
  private readonly macroprocesos: any[] = [];
  private readonly procesos: any[] = [];
  private readonly dependencias: any[] = [];
  private readonly vigencias: any[] = [];
  private readonly estados: { Id: number; Nombre: string }[] = [];

  private datosTerceros: any[] = [];

  constructor(
    private readonly auditorService: AuditorService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
    private readonly tercerosHelper: TercerosHelperService,
  ) {}

  async getAll(queryParams: any) {
    const query = queryParams?.query || '';

    // 1. Extraer estado_id sin mutar query original
    const queryParts = query ? query.split(',') : [];

    const queryEstado = queryParts.find((param: string) =>
      param.startsWith('estado_id'),
    );

    const querySinEstado = queryParts
      .filter((param: string) => !param.startsWith('estado_id'))
      .join(',');

    // 2. Query auditorías padre
    const queryPadre = {
      query: (querySinEstado || '').replace(
        'auditoria_padre_id',
        '_id',
      ),
      limit: 0,
      fields:
        '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id',
    };

    const dataPadre = await this.auditoriaCrudService.traerDataCrud(
      'auditoria-padre',
      null,
      queryPadre,
    );

    const auditoriasPadre: any[] = dataPadre?.Data || [];

    // 👉 Caso sin resultados
    if (!auditoriasPadre.length) {
      return {
        Data: [],
        MetaData: { Count: 0 },
      };
    }

    // 3. Construir query hijas
    const padresIds = auditoriasPadre.map((a) => a?._id).filter(Boolean);

    const baseQuery = [
      queryEstado,
      'activo:true',
      `auditoria_padre_id__in:${padresIds.join('|')}`,
    ]
      .filter(Boolean)
      .join(',');

    const queryHijas = {
      ...queryParams,
      query: baseQuery,
    };

    const dataHijas = await this.auditoriaCrudService.traerDataCrud(
      'auditoria',
      null,
      queryHijas,
    );

    const auditorias: any[] = dataHijas?.Data || [];

    // 4. Map de padres
    const padresMap = Object.fromEntries(
      auditoriasPadre.map((p) => [p._id, p]),
    );

    // 5. Merge padre + hija (seguro)
    const auditoriasUnidas = auditorias
      .map((a) => {
        const padre = padresMap[a?.auditoria_padre_id];
        if (!padre) return null;

        return {
          ...padre,
          ...a,
        };
      })
      .filter(Boolean);

    // 6. Construir respuesta final
    const result = {
      Data: auditoriasUnidas,
      MetaData: {
        Count: dataHijas?.MetaData?.Count || 0,
      },
    };

    // 7. Enriquecimiento
    await this.enriquecerAuditorias(result.Data);

    if (await this.identificarCampo(result)) {
      this.reemplazarCampos(result);
    }

    return result;
  }

  async getByAuditor(personaId: string, queryParams: any) {
    const query = queryParams?.query || '';
  
    // 1. Separar partes del query
    const queryParts = query ? query.split(',') : [];
  
    const queryEstado = queryParts.find((param: string) =>
      param.startsWith('estado_id'),
    );
  
    const querySinEstado = queryParts.filter(
      (param: string) => !param.startsWith('estado_id'),
    );
  
    // 2. Construir query de padres (más declarativo)
    const padreQueryStr = querySinEstado
      .filter(
        (param: string) =>
          param.startsWith('tipo_evaluacion_id') ||
          param.startsWith('dependencia_id') ||
          param.startsWith('vigencia_id'),
      )
      .join(',');
  
    const queryPadre = {
      query: padreQueryStr,
      limit: 0,
      fields:
        '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id',
    };
  
    const dataPadre = await this.auditoriaCrudService.traerDataCrud(
      'auditoria-padre',
      null,
      queryPadre,
    );
  
    const auditoriasPadre: any[] = dataPadre?.Data || [];
  
    // 👉 Caso sin padres
    if (!auditoriasPadre.length) {
      return {
        Data: [],
        MetaData: { Count: 0 },
      };
    }
  
    const padresIds = Array.from(
      new Set(auditoriasPadre.map((a) => a?._id).filter(Boolean)),
    );
  
    // 3. Query hijas
    const nuevaQuery = [
      queryEstado,
      'activo:true',
      `auditoria_padre_id__in:${padresIds.join('|')}`,
    ]
      .filter(Boolean)
      .join(',');
  
    const queryHijas = {
      ...queryParams,
      query: nuevaQuery,
    };
  
    const dataHijas = await this.auditoriaCrudService.traerDataCrud(
      'auditoria/auditor',
      personaId,
      queryHijas,
    );
  
    const auditorias: any[] = dataHijas?.Data || [];
  
    // 4. Map padres
    const padresMap = Object.fromEntries(
      auditoriasPadre.map((p) => [p._id, p]),
    );
  
    // 5. Merge seguro
    let auditoriasUnidas = auditorias
      .filter(
        (a) => a?.auditoria_padre_id && padresMap[a.auditoria_padre_id],
      )
      .map((a) => ({
        ...padresMap[a.auditoria_padre_id],
        ...a,
      }));
  
    const result = {
      Data: auditoriasUnidas,
      MetaData: {
        Count: dataHijas?.MetaData?.Count || 0,
      },
    };
  
    // 6. Enriquecimiento
    await this.enriquecerAuditorias(result.Data);
  
    if (await this.identificarCampo(result)) {
      this.reemplazarCampos(result);
    }
  
    return result;
  }

  async getByDependencia(
    personaId: number,
    cargoId: number,
    queryParams: any,
  ) {
    const dependenciaIds =
      await this.tercerosHelper.getDependenciasByPersona(
        personaId,
        cargoId,
      );
  
    // 👉 Sin dependencias → respuesta estándar
    if (!dependenciaIds?.length) {
      return {
        Data: [],
        MetaData: { Count: 0 },
      };
    }
  
    const query = queryParams?.query || '';
    const queryParts = query ? query.split(',') : [];
  
    const queryEstado = queryParts.find((param: string) =>
      param.startsWith('estado_id'),
    );
  
    const tipoEvalParam = queryParts.find((param: string) =>
      param.startsWith('tipo_evaluacion_id'),
    );
  
    const queryBase = queryParts.filter(
      (param: string) =>
        !param.startsWith('estado_id') &&
        !param.startsWith('tipo_evaluacion_id'),
    );
  
    // 1. Query padres
    const dependenciaFilter = `dependencia_id__in:${dependenciaIds.join('|')}`;
  
    const queryPadreFinal = [
      tipoEvalParam,
      ...queryBase,
      dependenciaFilter,
    ]
      .filter(Boolean)
      .join(',');
  
    const queryPadre = {
      query: queryPadreFinal,
      limit: 0,
      fields:
        '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id',
    };
  
    const dataPadre = await this.auditoriaCrudService.traerDataCrud(
      'auditoria-padre',
      null,
      queryPadre,
    );
  
    const auditoriasPadre: any[] = dataPadre?.Data || [];
  
    // 👉 Sin padres
    if (!auditoriasPadre.length) {
      return {
        Data: [],
        MetaData: { Count: 0 },
      };
    }
  
    const padresIds = auditoriasPadre
      .map((a) => a?._id)
      .filter(Boolean);
  
    // 2. Query hijas
    const queryHijas = {
      ...queryParams,
      query: [
        queryEstado,
        'activo:true',
        `auditoria_padre_id__in:${padresIds.join('|')}`,
      ]
        .filter(Boolean)
        .join(','),
    };
  
    const dataHijas = await this.auditoriaCrudService.traerDataCrud(
      'auditoria',
      null,
      queryHijas,
    );
  
    const auditoriasHijas: any[] = dataHijas?.Data || [];
  
    // 3. Merge
    const padresMap = Object.fromEntries(
      auditoriasPadre.map((p) => [p._id, p]),
    );
  
    const auditoriasUnidas = auditoriasHijas
      .filter(
        (a) => a?.auditoria_padre_id && padresMap[a.auditoria_padre_id],
      )
      .map((a) => ({
        ...padresMap[a.auditoria_padre_id],
        ...a,
      }));
  
    const result = {
      Data: auditoriasUnidas,
      MetaData: {
        Count: dataHijas?.MetaData?.Count || 0,
      },
    };
  
    // 👉 Si no hay data, salir temprano
    if (!result.Data.length) {
      return result;
    }
  
    // 4. Obtener dependencias únicas
    const todosDepIds: number[] = Array.from(
      new Set(
        result.Data.flatMap((a: any) => 
          this.asegurarArray(a.dependencia_id)
        ),
      ),
    );
  
    const dependenciaNombres = this.getDependenciaNombres(todosDepIds);
  
    // 5. Enriquecimiento
    await this.enriquecerAuditorias(result.Data, false);
  
    result.Data.forEach((auditoria: any) => {
      const ids = this.asegurarArray(auditoria.dependencia_id);
  
      auditoria.dependencia_nombre = ids
        .map((id: number) => dependenciaNombres.get(id))
        .filter(Boolean);
    });
  
    if (await this.identificarCampo(result)) {
      this.reemplazarCampos(result);
    }
  
    return result;
  }

  private asegurarArray(value: any): any[] {
    if (Array.isArray(value))
      return value;

    if (value != null)
      return [value];

    return [];
  }

  private getDependenciaNombres(dependenciaIds: number[]): Map<number, string> {
    const nombresMap = new Map<number, string>();
    this.dependencias.forEach((dep) => {
      if (dep?.Nombre) {
        nombresMap.set(dep.id, dep.Nombre);
      }
    });

    return nombresMap;
  }


  async getOne(id: string) {
    if (!id) {
      throw new BadRequestException('El id es requerido');
    }
  
    const auditoria = await this.auditoriaCrudService.traerDataCrud(
      'auditoria',
      id,
      null,
    );
  
    if (!auditoria?.Data) {
      throw new NotFoundException(`Auditoría con id ${id} no encontrada`);
    }
  
    const auditoriaPadreId = auditoria.Data.auditoria_padre_id;
  
    if (!auditoriaPadreId) {
      throw new NotFoundException(
        `La auditoría ${id} no tiene auditoría padre asociada`,
      );
    }
  
    const auditoriaPadre =
      await this.auditoriaCrudService.traerDataCrud(
        'auditoria-padre',
        auditoriaPadreId,
        null,
      );
  
    const result = {
      ...auditoria,
      Data: {
        ...(auditoriaPadre?.Data || {}),
        ...(auditoria.Data || {}),
      },
    };
  
    if (await this.identificarCampo(result)) {
      this.reemplazarCampos(result);
    }
  
    return result;
  }

  async getDatosTerceros(dependencia_id: number) {
    const [jefe_dep, asistente_dep] = await Promise.all([
      this.tercerosHelper.getTerceroVinculado(
        dependencia_id,
        environment.CARGO.JEFE_DEPENDENCIA_ID,
      ),
      this.tercerosHelper.getTerceroVinculado(
        dependencia_id,
        environment.CARGO.ASISTENTE_DEPENDENCIA_ID,
      ),
    ]);

    return {
      dependencia_id,
      jefe_nombre: jefe_dep?.NombreCompleto,
      jefe_correo: jefe_dep?.UsuarioWSO2,
      asistente_nombre: asistente_dep?.NombreCompleto,
      asistente_correo: asistente_dep?.UsuarioWSO2,
    };
  }

  private async enriquecerAuditorias(
    auditorias: any[],
    incluirAuditores = true,
  ) {
    if (!Array.isArray(auditorias) || auditorias.length === 0) {
      return;
    }
  
    await Promise.all(
      auditorias.map(async (auditoria) => {
        const queryParams = {
          query: `auditoria_id:${auditoria._id},actual:true`,
        };
  
        const promises: Promise<any>[] = [
          this.auditoriaCrudService.traerDataCrud(
            'auditoria-estado',
            null,
            queryParams,
          ),
        ];
  
        if (incluirAuditores) {
          promises.push(this.asociarAuditores(auditoria._id));
        }
  
        const [estadoResp, auditoresResp] = await Promise.all(promises);
  
        const estado = estadoResp?.Data?.[0];
  
        if (estado?.actual) {
          auditoria.estado = estado;
          auditoria.estado_id = estado.estado_id ?? null;
        } else {
          auditoria.estado = null;
          auditoria.estado_id = null;
        }
  
        if (incluirAuditores) {
          auditoria.auditores = Array.isArray(auditoresResp)
            ? auditoresResp
            : [];
        }
      }),
    );
  }

  private traerCorreoDependencia(dependenciaId: number): string {
    const dependencia = this.dependencias.find(
      (dep) => dep.Id === dependenciaId,
    );
    return dependencia ? dependencia.CorreoElectronico : 'Correo no encontrado';
  }

  private obtenerDependenciaPrincipal(
    dependenciaId: number | number[] | undefined | null,
  ): number | null {
    if (Array.isArray(dependenciaId)) {
      return dependenciaId.length > 0 ? dependenciaId[0] : null;
    }

    return typeof dependenciaId === 'number' ? dependenciaId : null;
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
        this.asegurarArray(data.Data.dependencia_id)
          .filter((dep_id) => dep_id != null)
          .forEach(async (dep_id) => {
            const datos = await this.getDatosTerceros(dep_id);
            this.datosTerceros.push(datos);
          });
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
      if (data.Data.dependencia_id !== undefined) {
        this.datosTerceros.forEach((datos) => {
          datos.correo_dependencia = this.traerCorreoDependencia(
            datos.dependencia_id,
          );
          datos.dependencia_nombre =
            this.dependencias.find((dep) => dep.Id === datos.dependencia_id)
              ?.Nombre || null;
        });
        data.Data = {
          ...data.Data,
          datos_dependencias: this.datosTerceros,
        };
        this.datosTerceros = [];
      }
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

  private async asociarAuditores(idAuditor: string) {
    const query = {
      auditoria_id: idAuditor,
      activo: true,
      asignado: true,
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
  
  async deleteAuditoria(
    auditoriaId: string,
    planAuditoriaId: string,
  ) {
    if (!auditoriaId) {
      throw new BadRequestException(
        'El parámetro "auditoriaId" es obligatorio.',
      );
    }
  
    if (!planAuditoriaId) {
      throw new BadRequestException(
        'El parámetro "planAuditoriaId" es obligatorio.',
      );
    }
  
    // 1. Obtener plan primero (IMPORTANTE)
    const planResponse =
      await this.auditoriaCrudService.traerDataCrud(
        'plan-auditoria',
        planAuditoriaId,
        null,
      );
  
    const plan = planResponse?.Data;
  
    if (!plan) {
      throw new NotFoundException(
        `Plan de auditoría ${planAuditoriaId} no encontrado`,
      );
    }
  
    const auditorias = Array.isArray(plan.auditorias)
      ? plan.auditorias
      : [];
  
    // 2. Validar que la auditoría exista en el plan
    if (!auditorias.includes(auditoriaId)) {
      throw new NotFoundException(
        `La auditoría ${auditoriaId} no está asociada al plan ${planAuditoriaId}`,
      );
    }
  
    // 3. Eliminar auditoría del arreglo
    const auditoriasActualizadas = auditorias.filter(
      (id: string) => id !== auditoriaId,
    );
  
    // 4. Actualizar plan
    await this.auditoriaCrudService.put(
      'plan-auditoria',
      planAuditoriaId,
      {
        auditorias: auditoriasActualizadas,
      },
    );
  
    // 5. Eliminar auditoría (DESPUÉS de validar el resto)
    await this.auditoriaCrudService.delete(
      'auditoria',
      auditoriaId,
    );
  
    return {
      message: 'Auditoría eliminada exitosamente',
    };
  }
}
