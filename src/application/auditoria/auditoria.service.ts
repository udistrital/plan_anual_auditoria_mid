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
  OIKOS_SERVICE,
} = environment;

@Injectable()
export class AuditoriaService {
  private tiposEvaluacion: any[] = [];
  private cronogramasActividad: any[] = [];
  private macroprocesos: any[] = [];
  private procesos: any[] = [];
  private dependencias: any[] = [];
  private vigencias: any[] = [];
  private estados: { Id: number; Nombre: string }[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly auditorService: AuditorService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    const queryEstado = queryParams.query
      ? queryParams.query.split(',').filter((param: string) => param.startsWith('estado_id:'))[0]
      : undefined;

    if (queryParams.query) {
      queryParams.query = queryParams.query
        .split(',')
        .filter((param: string) => !param.startsWith('estado_id:'))
        .join(',');
    }

    const queryPadre = {
      query: (queryParams.query ?? '').replace('auditoria_padre_id', '_id'),
      limit: 0,
      fields: '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id,correo_complementario',
    };

    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', null, queryPadre);
    const auditoriasPadre: any[] = data.Data;

    if (auditoriasPadre.length > 0) {
      const padresIds: string[] = auditoriasPadre.map(a => a?._id);

      const nuevaQuery = queryEstado
        ? `${queryEstado},activo:true,auditoria_padre_id__in:${padresIds.join('|')}`
        : `activo:true,auditoria_padre_id__in:${padresIds.join('|')}`;

      const queryHijas = { ...queryParams, query: nuevaQuery };
      const data2 = await this.auditoriaCrudService.traerDataCrud('auditoria', null, queryHijas);
      const auditorias: any[] = data2.Data;

      const padresMap = Object.fromEntries(auditoriasPadre.map(p => [p?._id, p]));
      data.Data = auditorias.map(a => ({
        ...(padresMap[a?.auditoria_padre_id] || {}),
        ...a,
      }));
      data.MetaData.Count = data2.MetaData.Count;
    }

    await this.enriquecerAuditorias(data.Data);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByAuditor(personaId: string, queryParams: any) {
    const queryEstado = queryParams.query
      ? queryParams.query.split(',').filter((param: string) => param.startsWith('estado_id:'))[0]
      : '';

    if (queryParams.query) {
      queryParams.query = queryParams.query
        .split(',')
        .filter((param: string) => !param.startsWith('estado_id:'))
        .join(',');
    }

    let padreQueryStr = '';
    for (const param of (queryParams.query ?? '').split(',')) {
      if (
        param.startsWith('tipo_evaluacion_id:') ||
        param.startsWith('dependencia_id:') ||
        param.startsWith('vigencia_id:')
      ) {
        padreQueryStr += padreQueryStr ? `,${param}` : param;
      }
    }

    const queryPadre = {
      query: padreQueryStr,
      limit: 0,
      fields: '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id,correo_complementario',
    };

    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', null, queryPadre);
    const auditorias_padre: any[] = data.Data;
    const padresIds: string[] = Array.from(new Set(auditorias_padre.map(a => a?._id).filter(Boolean)));

    if (auditorias_padre.length > 0) {
      const nuevaQuery = queryEstado
        ? `${queryEstado},activo:true,auditoria_padre_id__in:${padresIds.join('|')}`
        : `activo:true,auditoria_padre_id__in:${padresIds.join('|')}`;

      const queryHijas = { ...queryParams, query: nuevaQuery };
      const data2 = await this.auditoriaCrudService.traerDataCrud('auditoria/auditor', personaId, queryHijas);
      const auditorias: any[] = data2.Data;

      const padresMap = Object.fromEntries(auditorias_padre.map(p => [p?._id, p]));
      data.Data = auditorias
        .filter(a => a?.auditoria_padre_id && a.auditoria_padre_id in padresMap)
        .map(a => ({
          ...(padresMap[a?.auditoria_padre_id] || {}),
          ...a,
        }));
      data.MetaData.Count = data2.MetaData.Count;
    }

    await this.enriquecerAuditorias(data.Data);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByDependencia(personaId: number, cargoId: number, queryParams: any) {
    const dependenciaIds = await this.getDependenciasByPersona(personaId, cargoId);

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

    const tipoEvalParam = queryParams.query
      ? queryParams.query.split(',').filter((param: string) => param.startsWith('tipo_evaluacion_id:'))[0]
      : undefined;

    const additionalFilters = `dependencia_id__in:${dependenciasFilter}`;
    let queryPadreFinal = queryPadreBase
      ? `${queryPadreBase},${additionalFilters}`
      : additionalFilters;

    if (tipoEvalParam) {
      queryPadreFinal = `${tipoEvalParam},${queryPadreFinal}`;
    }

    const queryPadre = {
      query: queryPadreFinal,
      limit: 0,
      fields: '_id,titulo,tipo_evaluacion_id,macroproceso_id,proceso_id,dependencia_id,correo_complementario',
    };

    const data = await this.auditoriaCrudService.traerDataCrud('auditoria-padre', null, queryPadre);
    const auditorias: any[] = data.Data;

    if (auditorias.length > 0) {
      const ids: string[] = auditorias.map(a => a?._id);

      const nuevaQueryParts: string[] = [];
      if (queryEstado) nuevaQueryParts.push(queryEstado);
      nuevaQueryParts.push('activo:true');
      nuevaQueryParts.push(`auditoria_padre_id__in:${ids.join('|')}`);

      const queryHijas = { ...queryParams, query: nuevaQueryParts.join(',') };
      const data2 = await this.auditoriaCrudService.traerDataCrud('auditoria', null, queryHijas);
      const auditorias_hijas: any[] = data2.Data;

      const padresMap = Object.fromEntries(auditorias.map(p => [p?._id, p]));
      data.Data = auditorias_hijas
        .filter(a => a?.auditoria_padre_id && a.auditoria_padre_id in padresMap)
        .map(a => ({
          ...(padresMap[a?.auditoria_padre_id] || {}),
          ...a,
        }));
      data.MetaData.Count = data2.MetaData.Count;
    }

    if (data.Data?.length > 0) {
      await this.enriquecerAuditorias(data.Data, false);
      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }
    }

    return data;
  }

  private async getDependenciasByPersona(personaId: number, cargoId: number): Promise<number[]> {
    const url = `${TERCEROS_SERVICE}vinculacion?query=TerceroPrincipalId:${personaId},Activo:true,CargoId:${cargoId}&fields=DependenciaId`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const lista = Array.isArray(response.data)
        ? response.data
        : response.data?.value ?? [];
      if (lista.length === 0) return [];
      return lista
        .map((v: any) => v.DependenciaId)
        .filter((id: any) => id != null);
    } catch {
      throw new HttpException(
        'Error al obtener las dependencias del usuario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOne(id: string) {
    const auditoria = await this.auditoriaCrudService.traerDataCrud('auditoria', id, null);
    const auditoria_padre = await this.auditoriaCrudService.traerDataCrud(
      'auditoria-padre',
      auditoria.Data.auditoria_padre_id,
      null,
    );

    const data = {
      ...auditoria,
      Data: { ...auditoria_padre.Data, ...auditoria.Data },
    };

    await this.enriquecerAuditorias([data.Data], false);

    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getDatosTerceros(dependenciaId: number) {
    const [jefe, asistente] = await Promise.all([
      this.traerTerceroVinculado(dependenciaId, environment.CARGO.JEFE_DEPENDENCIA_ID),
      this.traerTerceroVinculado(dependenciaId, environment.CARGO.ASISTENTE_DEPENDENCIA_ID),
    ]);

    return {
      ...(jefe?.nombre && { jefe_nombre: jefe.nombre }),
      ...(jefe?.correo && { jefe_correo: jefe.correo }),
      ...(asistente?.nombre && { asistente_nombre: asistente.nombre }),
      ...(asistente?.correo && { asistente_correo: asistente.correo }),
    };
  }

  async traerTerceroVinculado(
    dependenciaId: number,
    cargoId: number,
  ): Promise<{ nombre: string; correo: string } | null> {
    const url = `${TERCEROS_SERVICE}vinculacion?order=desc&sortby=Id`
      + `&query=Activo:true,DependenciaId:${dependenciaId},CargoId:${cargoId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const lista = Array.isArray(response.data)
        ? response.data
        : response.data?.value ?? [];
      const tercero = lista[0]?.TerceroPrincipalId;
      if (!tercero?.Id) return null;
      return {
        nombre: tercero.NombreCompleto || null,
        correo: tercero.UsuarioWSO2 || null,
      };
    } catch {
      return null;
    }
  }

  private async resolverInfoDependencia(
    dependenciaId: number,
    correosComplementarios: any[] = [],
  ): Promise<any> {
    const url = `${OIKOS_SERVICE}dependencia/${dependenciaId}`;

    const [depResponse, datosTerceros] = await Promise.all([
      lastValueFrom(this.httpService.get(url)),
      this.getDatosTerceros(dependenciaId),
    ]);

    const dep = depResponse.data;

    const complementario = Array.isArray(correosComplementarios)
      ? correosComplementarios.find(c => c?.dependencia_id === dependenciaId)
      : undefined;

    return {
      dependencia_id: dependenciaId,
      ...(dep?.Nombre && { dependencia_nombre: dep.Nombre }),
      ...(dep?.CorreoElectronico?.trim() && { correo_dependencia: dep.CorreoElectronico.trim() }),
      ...datosTerceros,
      ...(complementario?.correo?.trim() && {
        correo_complementario: complementario.correo.trim(),
      }),
    };
  }

  private async resolverInfoDependencias(
    dependenciaIds: number[],
    correosComplementarios: { dependencia_id: number; correo_complementario: string }[] = [],
  ): Promise<any[]> {
    return Promise.all(
      dependenciaIds.map(id => this.resolverInfoDependencia(id, correosComplementarios)),
    );
  }

  private async enriquecerAuditorias(auditorias: any[], incluirAuditores = true) {
    await Promise.all(
      auditorias.map(async (auditoria) => {
        const queryParams = { query: `auditoria_id:${auditoria._id},actual:true` };
        const promises: Promise<any>[] = [
          this.auditoriaCrudService.traerDataCrud('auditoria-estado', null, queryParams),
        ];
        if (incluirAuditores) promises.push(this.asociarAuditores(auditoria._id));

        const [estado, auditores] = await Promise.all(promises);

        if (estado.Data[0]?.actual) {
          auditoria.estado = estado.Data[0];
          auditoria.estado_id = estado.Data[0]?.estado_id;
        }
        if (incluirAuditores) auditoria.auditores = auditores || [];

        const depIds: number[] = Array.isArray(auditoria.dependencia_id)
          ? auditoria.dependencia_id
          : auditoria.dependencia_id != null
            ? [auditoria.dependencia_id]
            : [];

        if (depIds.length > 0) {
          auditoria.dependencias_info = await this.resolverInfoDependencias(
            depIds,
            auditoria.correo_complementario || [],
          );
        }
      }),
    );
  }

  private async identificarCampo(data: any) {
    const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
    if (!firstElement) return false;

    const camposConfig = [
      { campo: 'tipo_evaluacion_id', tipoParametro: TIPO_PARAMETRO.TIPO_EVALUACION, destino: this.tiposEvaluacion },
      { campo: 'cronograma_id', tipoParametro: TIPO_PARAMETRO.CRONOGRAMA, destino: this.cronogramasActividad },
      { campo: 'estado_id', tipoParametro: TIPO_PARAMETRO.AUDITORIA_ESTADO, destino: this.estados },
      { campo: 'macroproceso_id', tipoParametro: TIPO_PARAMETRO.MACROPROCESO, destino: this.macroprocesos },
      { campo: 'proceso_id', tipoParametro: TIPO_PARAMETRO.PROCESO, destino: this.procesos },
      { campo: 'vigencia_id', tipoParametro: TIPO_PARAMETRO.VIGENCIA, destino: this.vigencias },
    ];

    const observables: Record<string, any> = {};
    const camposPresentes = camposConfig.filter(config => config.campo in firstElement);
    camposPresentes.forEach(config => {
      observables[config.campo] = this.dominiosService.getParametros(config.tipoParametro);
    });

    if (Object.keys(observables).length === 0) return false;

    const resultados = (await lastValueFrom(forkJoin(observables))) as Record<string, Dominio>;
    camposPresentes.forEach(config => {
      if (resultados[config.campo]) {
        config.destino.push(...resultados[config.campo].parametros);
      }
    });

    return true;
  }

  private reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element: any) => {
        if (element.tipo_evaluacion_id !== undefined) this.reemplazar(this.tiposEvaluacion, element, 'tipo_evaluacion_id');
        if (element.cronograma_id !== undefined) this.reemplazar(this.cronogramasActividad, element, 'cronograma_id');
        if (element.estado_id !== undefined) this.reemplazar(this.estados, element, 'estado_id');
        if (element.macroproceso_id !== undefined) this.reemplazar(this.macroprocesos, element, 'macroproceso_id');
        if (element.vigencia_id !== undefined) this.reemplazar(this.vigencias, element, 'vigencia_id');
        if (element.proceso_id !== undefined) this.reemplazar(this.procesos, element, 'proceso_id');
        element.cronograma = this.unirCronogramaNombres(element.cronograma_nombre);
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.tipo_evaluacion_id !== undefined) this.reemplazar(this.tiposEvaluacion, data.Data, 'tipo_evaluacion_id');
      if (data.Data.cronograma_id !== undefined) this.reemplazar(this.cronogramasActividad, data.Data, 'cronograma_id');
      if (data.Data.estado_id !== undefined) this.reemplazar(this.estados, data.Data, 'estado_id');
      if (data.Data.macroproceso_id !== undefined) this.reemplazar(this.macroprocesos, data.Data, 'macroproceso_id');
      if (data.Data.vigencia_id !== undefined) this.reemplazar(this.vigencias, data.Data, 'vigencia_id');
      if (data.Data.proceso_id !== undefined) this.reemplazar(this.procesos, data.Data, 'proceso_id');
    }
    return data;
  }

  private reemplazar(array: any[], element: any, campo: string) {
    const value = element[campo];
    const nuevoCampo = campo.endsWith('_id') ? campo.replace('_id', '_nombre') : `${campo}_nombre`;

    if (Array.isArray(value)) {
      element[nuevoCampo] = value.map(id => {
        const encontrado = array.find(param => param.Id === id);
        return encontrado ? encontrado.Nombre : id;
      });
    } else {
      const encontrado = array.find(param => param.Id === value);
      element[nuevoCampo] = encontrado ? encontrado.Nombre : null;
    }
    return element;
  }

  private async asociarAuditores(idAuditor: string) {
    const queryParam = {
      query: `auditoria_id:${idAuditor},activo:true`,
      limit: 0,
      fields: '_id,auditor_lider,auditor_id,asignado_por_id',
    };
    const auditoresAuditoria = await this.auditorService.getAll(queryParam);
    return auditoresAuditoria.Data;
  }

  private unirCronogramaNombres(cronograma_nombre: any[]) {
    if (Array.isArray(cronograma_nombre) && cronograma_nombre.length === 12) {
      const mesesCompletos = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      if (mesesCompletos.every(mes => cronograma_nombre.some(nombre => nombre === mes))) {
        return 'Todos';
      }
    }
    return unirListaNombresConComas(cronograma_nombre);
  }

  async deleteAuditoria(auditoriaId: string, planAuditoriaId: string) {
    if (!planAuditoriaId) {
      throw new HttpException('El parámetro "plan_auditoria_id" es obligatorio.', HttpStatus.BAD_REQUEST);
    }
    try {
      await lastValueFrom(this.httpService.delete(`${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/${auditoriaId}`));
      const planResponse = await lastValueFrom(this.httpService.get(`${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planAuditoriaId}`));
      const plan = planResponse.data.Data;
      const auditoriasActualizadas = plan.auditorias.filter((id: string) => id !== auditoriaId);
      await lastValueFrom(this.httpService.put(`${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planAuditoriaId}`, { auditorias: auditoriasActualizadas }));
      return { Success: true, Status: 200, Message: 'Auditoría eliminada exitosamente', Data: null };
    } catch (error) {
      throw new HttpException(
        error.response?.data?.message || 'Error al eliminar la auditoría',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}