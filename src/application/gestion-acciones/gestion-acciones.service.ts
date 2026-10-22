import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const { TIPO_PARAMETRO, PLAN_MEJORAMIENTO_ESTADO, ACCION_MEJORA } = environment;

const TAMANO_LOTE = 100;
const MS_POR_DIA = 86_400_000;

export type GrupoAccion =
  | 'PENDIENTE_HABILITAR'
  | 'CARGUE_ABIERTO'
  | 'EN_REVISION'
  | 'CALIFICADAS';
export type AlcanceAuditor = 'asignadas' | 'todas';

const GRUPOS_VALIDOS: string[] = [
  'PENDIENTE_HABILITAR',
  'CARGUE_ABIERTO',
  'EN_REVISION',
  'CALIFICADAS',
  'EN_RIESGO',
];

export interface FilaGestionAccion {
  accion_id: string;
  plan_mejoramiento_id: string;
  auditoria_id: string;
  no_auditoria: string;
  nombre_auditoria: string;
  tipo_evaluacion_nombre: string;
  no_hallazgo: string;
  descripcion_hallazgo: string;
  no_accion: string;
  tipo_accion_nombre: string;
  descripcion_accion: string;
  /** '' si no hay responsable líder. */
  dependencia_lider: string;
  dependencias_apoyo: string[];
  auditores_plan: string[];
  fecha_inicio: string | null;
  fecha_fin: string | null;
  en_revision: boolean;
  total_soportes: number;
  calificacion: number | null;
  fecha_calificacion: string | null;
  grupo: GrupoAccion;
  eficaz: boolean;
  en_riesgo: boolean;
  /** Días hasta fecha_fin (negativo si venció); null sin fecha_fin. */
  dias_para_vencer: number | null;
  /** La persona consultada es auditor del plan (solo vista auditor; false en auditado). */
  auditor_plan_asignado: boolean;
}

export interface ResumenGestionAcciones {
  total: number;
  pendiente_habilitar: number;
  cargue_abierto: number;
  en_revision: number;
  calificadas: number;
  eficaces: number;
  en_riesgo: number;
}

export interface DatosClasificacion {
  en_revision: boolean;
  total_soportes: number;
  calificacion: number | null;
  fecha_fin: string | null;
}

/**
 * Grupo de la acción (excluyente, por orden de precedencia), eficacia y riesgo.
 * en_revision = true significa cargue habilitado para el auditado.
 */
export function clasificarAccion(datos: DatosClasificacion, hoy: Date) {
  const inicioDeHoy = new Date(hoy);
  inicioDeHoy.setHours(0, 0, 0, 0);

  const diasParaVencer = datos.fecha_fin
    ? Math.ceil(
        (new Date(datos.fecha_fin).getTime() - inicioDeHoy.getTime()) /
          MS_POR_DIA,
      )
    : null;
  const calificada = datos.calificacion !== null;

  let grupo: GrupoAccion;
  if (datos.en_revision) grupo = 'CARGUE_ABIERTO';
  else if (calificada) grupo = 'CALIFICADAS';
  else if (datos.total_soportes >= 1) grupo = 'EN_REVISION';
  else grupo = 'PENDIENTE_HABILITAR';

  const eficaz =
    calificada && (datos.calificacion as number) >= ACCION_MEJORA.UMBRAL_EFICACIA;
  const enRiesgo =
    diasParaVencer !== null &&
    diasParaVencer <= ACCION_MEJORA.DIAS_RIESGO &&
    !eficaz;

  return { grupo, eficaz, en_riesgo: enRiesgo, dias_para_vencer: diasParaVencer };
}

interface FiltrosGestion {
  vigencia_id: number;
  tipo_evaluacion_id: number;
  alcance: AlcanceAuditor;
  grupo?: GrupoAccion | 'EN_RIESGO';
  no_auditoria?: string;
  accion_hallazgo?: string;
  dependencia?: string;
  auditor?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

type AlcanceConsulta =
  | { tipo: 'auditado'; personaId: number; cargoId: number }
  | { tipo: 'auditor'; personaId: number; alcance: AlcanceAuditor };

interface DatosAuditoria {
  no: string;
  nombre: string;
  tipo_evaluacion_id: number | null;
}

interface AuditorPlan {
  id: number;
  nombre: string;
}

interface ResponsablesAccion {
  lider: string[];
  apoyo: string[];
  dependenciaIds: Set<number>;
}

interface FiltrosGestionAcciones {
  vigencia_id: number;
  no_auditoria?: string;
  nombre_auditoria?: string;
  no_hallazgo?: string;
  no_accion?: string;
  auditor?: string;
  dependencia?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

interface FilaAccion {
  accion_id: string;
  plan_mejoramiento_id: string;
  no_auditoria: string;
  nombre_auditoria: string;
  no_hallazgo: string;
  no_accion: string;
  auditores_responsables_plan: string;
  dependencia_responsable: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado_nombre: string | null;
}

@Injectable()
export class GestionAccionesService {
  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(query: any) {
    const filtros = this.parsearFiltros(query);

    if (!filtros.vigencia_id) {
      return this.respuesta([], 0);
    }

    // Planes de la vigencia
    const planes = await this.obtenerPlanesPorVigencia(filtros.vigencia_id);
    if (planes.length === 0) {
      return this.respuesta([], 0);
    }
    const planIds = planes.map((p) => p._id);
    const planMap = new Map<string, any>(planes.map((p) => [p._id, p]));

    // Acciones de esos planes (push-down de no_accion) con plan + hallazgo populados
    const acciones = await this.obtenerAcciones(planIds, filtros.no_accion);
    if (acciones.length === 0) {
      return this.respuesta([], 0);
    }
    const accionIds = acciones.map((a) => a._id);

    // Datos relacionados en paralelo
    const [responsablesMap, auditoresMap, estadosMap] = await Promise.all([
      this.construirMapResponsables(accionIds),
      this.construirMapAuditoresPorPlan(planIds),
      this.construirMapEstados(),
    ]);

    // Auditorías (número + nombre) por auditoria_id único, con caché
    const auditoriaIds = this.extraerAuditoriaIds(planes);
    const auditoriaMap = await this.construirMapAuditorias(auditoriaIds);

    // Mapear filas
    const filas = acciones.map((accion) =>
      this.mapearFila(
        accion,
        planMap,
        auditoriaMap,
        responsablesMap,
        auditoresMap,
        estadosMap,
      ),
    );

    // Filtros en memoria + paginación
    const filtradas = this.aplicarFiltrosEnMemoria(filas, filtros);
    const total = filtradas.length;
    const paginadas = this.paginar(filtradas, filtros.limit, filtros.offset);

    return this.respuesta(paginadas, total);
  }

  private async obtenerPlanesPorVigencia(vigenciaId: number): Promise<any[]> {
    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento',
      null,
      {
        query: `vigencia_id:${vigenciaId},activo:true`,
        fields: '_id,auditoria_id,estado_id',
        limit: 0,
      },
    );
    return res?.Data ?? [];
  }

  private async obtenerAcciones(
    planIds: string[],
    noAccion?: string,
  ): Promise<any[]> {
    const condiciones = [
      `plan_mejoramiento_id__in:${planIds.join('|')}`,
      'activo:true',
    ];
    if (noAccion) {
      condiciones.push(`no_accion__icontains:${noAccion}`);
    }

    const res = await this.auditoriaCrudService.traerDataCrud(
      'accion-mejora',
      null,
      {
        query: condiciones.join(','),
        populate: 'true',
        limit: 0,
      },
    );
    return res?.Data ?? [];
  }

  private async construirMapResponsables(
    accionIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (accionIds.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud(
      'responsable-accion',
      null,
      {
        query: `accion_mejora_id__in:${accionIds.join('|')},activo:true`,
        limit: 0,
      },
    );
    const responsables: any[] = res?.Data ?? [];
    if (responsables.length === 0) return map;

    const dominio = await firstValueFrom(this.dominiosService.getDependencias());
    const dependenciasMap = new Map<number, string>(
      dominio.parametros.map((dep: any) => [dep.Id, dep.Nombre]),
    );

    for (const r of responsables) {
      const accionId = this.idDeRef(r.accion_mejora_id);
      const nombre = dependenciasMap.get(r.dependencia_id);
      if (!accionId || !nombre) continue;
      const lista = map.get(accionId) ?? [];
      lista.push(nombre);
      map.set(accionId, lista);
    }
    return map;
  }

  private async construirMapAuditoresPorPlan(
    planIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (planIds.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento-auditor',
      null,
      {
        query: `plan_mejoramiento_id__in:${planIds.join('|')},activo:true`,
        limit: 0,
      },
    );
    const auditores: any[] = res?.Data ?? [];
    if (auditores.length === 0) return map;

    // Resolver nombres de auditor_id únicos (caché)
    const idsUnicos = [
      ...new Set(auditores.map((a) => a.auditor_id).filter(Boolean)),
    ];
    const nombrePorAuditor = new Map<number, string>();
    await Promise.all(
      idsUnicos.map(async (auditorId) => {
        const tercero = await this.tercerosHelper.getTerceroById(
          String(auditorId),
        );
        nombrePorAuditor.set(
          auditorId,
          tercero?.NombreCompleto ?? `Auditor ${auditorId}`,
        );
      }),
    );

    for (const a of auditores) {
      const planId = this.idDeRef(a.plan_mejoramiento_id);
      const nombre = nombrePorAuditor.get(a.auditor_id);
      if (!planId || !nombre) continue;
      const lista = map.get(planId) ?? [];
      lista.push(nombre);
      map.set(planId, lista);
    }
    return map;
  }

  private async construirMapEstados(): Promise<Map<number, string>> {
    const dominio = await firstValueFrom(
      this.dominiosService.getParametros(TIPO_PARAMETRO.AUDITORIA_ESTADO),
    );
    return new Map<number, string>(
      (dominio.parametros as any[]).map((p) => [p.Id, p.Nombre]),
    );
  }

  private async construirMapAuditorias(
    auditoriaIds: string[],
  ): Promise<Map<string, { no: string; nombre: string }>> {
    const map = new Map<string, { no: string; nombre: string }>();

    await Promise.all(
      auditoriaIds.map(async (auditoriaId) => {
        try {
          const auditoriaRes = await this.auditoriaCrudService.traerDataCrud(
            'auditoria',
            auditoriaId,
            null,
          );
          const auditoria = auditoriaRes?.Data;
          if (!auditoria) return;

          const no =
            auditoria.consecutivo_no_auditoria != null
              ? String(auditoria.consecutivo_no_auditoria)
              : '';

          let nombre = '';
          if (auditoria.auditoria_padre_id) {
            const padreRes = await this.auditoriaCrudService.traerDataCrud(
              'auditoria-padre',
              String(auditoria.auditoria_padre_id),
              null,
            );
            nombre = padreRes?.Data?.titulo ?? '';
          }
          map.set(auditoriaId, { no, nombre });
        } catch {
          // auditoría no resoluble: se deja sin entrada (fila con campos vacíos)
        }
      }),
    );
    return map;
  }

  private mapearFila(
    accion: any,
    planMap: Map<string, any>,
    auditoriaMap: Map<string, { no: string; nombre: string }>,
    responsablesMap: Map<string, string[]>,
    auditoresMap: Map<string, string[]>,
    estadosMap: Map<number, string>,
  ): FilaAccion {
    const planId = this.idDeRef(accion.plan_mejoramiento_id);
    const plan = planId ? planMap.get(planId) : null;
    const auditoriaId = plan ? this.idDeRef(plan.auditoria_id) : null;
    const auditoria = auditoriaId ? auditoriaMap.get(auditoriaId) : null;

    return {
      accion_id: String(accion._id),
      plan_mejoramiento_id: planId ?? '',
      no_auditoria: auditoria?.no ?? '',
      nombre_auditoria: auditoria?.nombre ?? '',
      no_hallazgo: this.refPopulada(accion.hallazgo_id)?.no_hallazgo ?? '',
      no_accion: accion.no_accion ?? '',
      auditores_responsables_plan: planId
        ? (auditoresMap.get(planId) ?? []).join(', ')
        : '',
      dependencia_responsable: (responsablesMap.get(String(accion._id)) ?? []).join(
        ', ',
      ),
      fecha_inicio: accion.fecha_inicio ?? null,
      fecha_fin: accion.fecha_fin ?? null,
      estado_nombre:
        plan?.estado_id != null
          ? (estadosMap.get(plan.estado_id) ?? null)
          : null,
    };
  }

  private aplicarFiltrosEnMemoria(
    filas: FilaAccion[],
    f: FiltrosGestionAcciones,
  ): FilaAccion[] {
    return filas.filter((fila) => {
      if (f.no_auditoria && !this.incluye(fila.no_auditoria, f.no_auditoria))
        return false;
      if (
        f.nombre_auditoria &&
        !this.incluye(fila.nombre_auditoria, f.nombre_auditoria)
      )
        return false;
      if (f.no_hallazgo && !this.incluye(fila.no_hallazgo, f.no_hallazgo))
        return false;
      if (
        f.auditor &&
        !this.incluye(fila.auditores_responsables_plan, f.auditor)
      )
        return false;
      if (
        f.dependencia &&
        !this.incluye(fila.dependencia_responsable, f.dependencia)
      )
        return false;
      if (f.desde && !this.fechaDesde(fila.fecha_inicio, f.desde)) return false;
      if (f.hasta && !this.fechaHasta(fila.fecha_inicio, f.hasta)) return false;
      return true;
    });
  }

  private paginar<T>(filas: T[], limit?: number, offset?: number): T[] {
    if (!limit || limit <= 0) return filas;
    const inicio = offset ?? 0;
    return filas.slice(inicio, inicio + limit);
  }

  private parsearFiltros(query: any): FiltrosGestionAcciones {
    return {
      vigencia_id: query.vigencia_id ? Number(query.vigencia_id) : 0,
      no_auditoria: query.no_auditoria?.trim() || undefined,
      nombre_auditoria: query.nombre_auditoria?.trim() || undefined,
      no_hallazgo: query.no_hallazgo?.trim() || undefined,
      no_accion: query.no_accion?.trim() || undefined,
      auditor: query.auditor?.trim() || undefined,
      dependencia: query.dependencia?.trim() || undefined,
      desde: query.desde || undefined,
      hasta: query.hasta || undefined,
      limit: query.limit != null ? Number(query.limit) : undefined,
      offset: query.offset != null ? Number(query.offset) : undefined,
    };
  }

  /** Extrae el _id de una referencia que puede venir como string u objeto populado. */
  private idDeRef(ref: any): string | null {
    if (!ref) return null;
    if (typeof ref === 'object') return ref._id ? String(ref._id) : null;
    return String(ref);
  }

  /** Devuelve el objeto populado si la referencia vino como objeto, si no null. */
  private refPopulada(ref: any): any | null {
    return ref && typeof ref === 'object' ? ref : null;
  }

  private extraerAuditoriaIds(planes: any[]): string[] {
    return [
      ...new Set(
        planes
          .map((p) => this.idDeRef(p.auditoria_id))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  private incluye(valor: string, busqueda: string): boolean {
    return (valor ?? '').toLowerCase().includes(busqueda.toLowerCase());
  }

  private fechaDesde(fecha: string | null, desde: string): boolean {
    if (!fecha) return false;
    return new Date(fecha) >= new Date(desde);
  }

  private fechaHasta(fecha: string | null, hasta: string): boolean {
    if (!fecha) return false;
    return new Date(fecha) <= new Date(hasta);
  }

  // ── Vistas del auditado y del auditor ─────────────────────

  /** Conteos de las acciones del auditado por grupo; ignora filtros de texto, fechas y grupo. */
  async getResumenAuditado(personaId: number, cargoId: number, query: any) {
    const filtros = this.parsearFiltrosGestion(query);
    const filas = await this.construirFilasDelAlcance(filtros, {
      tipo: 'auditado',
      personaId,
      cargoId,
    });
    return this.respuestaResumen(filas);
  }

  /** Acciones de los planes aprobados de las dependencias del auditado, filtradas y paginadas. */
  async getAllAuditado(personaId: number, cargoId: number, query: any) {
    const filtros = this.parsearFiltrosGestion(query);
    const filas = await this.construirFilasDelAlcance(filtros, {
      tipo: 'auditado',
      personaId,
      cargoId,
    });
    return this.responderFilas(filas, filtros);
  }

  /** Conteos de las acciones que ve el auditor por grupo; ignora filtros de texto, fechas y grupo. */
  async getResumenAuditor(personaId: number, query: any) {
    const filtros = this.parsearFiltrosGestion(query);
    const filas = await this.construirFilasDelAlcance(filtros, {
      tipo: 'auditor',
      personaId,
      alcance: filtros.alcance,
    });
    return this.respuestaResumen(filas);
  }

  /** Acciones de los planes aprobados que ve el auditor según su alcance, filtradas y paginadas. */
  async getAllAuditor(personaId: number, query: any) {
    const filtros = this.parsearFiltrosGestion(query);
    const filas = await this.construirFilasDelAlcance(filtros, {
      tipo: 'auditor',
      personaId,
      alcance: filtros.alcance,
    });
    return this.responderFilas(filas, filtros);
  }

  private responderFilas(filas: FilaGestionAccion[], filtros: FiltrosGestion) {
    const filtradas = this.aplicarFiltrosGestion(filas, filtros);
    return this.respuesta(
      this.paginar(filtradas, filtros.limit, filtros.offset),
      filtradas.length,
    );
  }

  private respuestaResumen(filas: FilaGestionAccion[]) {
    const contar = (grupo: GrupoAccion) =>
      filas.filter((f) => f.grupo === grupo).length;
    const data: ResumenGestionAcciones = {
      total: filas.length,
      pendiente_habilitar: contar('PENDIENTE_HABILITAR'),
      cargue_abierto: contar('CARGUE_ABIERTO'),
      en_revision: contar('EN_REVISION'),
      calificadas: contar('CALIFICADAS'),
      eficaces: filas.filter((f) => f.eficaz).length,
      en_riesgo: filas.filter((f) => f.en_riesgo).length,
    };
    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de resumen exitosa.',
      Data: data,
    };
  }

  /**
   * Acciones activas de los planes aprobados (o finalizados) de la vigencia y el tipo de
   * evaluación, dentro del alcance de la persona, con el grupo de cada una ya calculado.
   */
  private async construirFilasDelAlcance(
    filtros: FiltrosGestion,
    alcance: AlcanceConsulta,
  ): Promise<FilaGestionAccion[]> {
    if (!filtros.vigencia_id || !filtros.tipo_evaluacion_id) return [];

    // Auditado: sin dependencias vinculadas no tiene acciones que ver
    let dependenciasAuditado: Set<number> | null = null;
    if (alcance.tipo === 'auditado') {
      const ids = await this.tercerosHelper.getDependenciasByPersona(
        alcance.personaId,
        alcance.cargoId,
      );
      if (!ids?.length) return [];
      dependenciasAuditado = new Set(ids.map(Number));
    }

    // Planes aprobados o finalizados y su auditoría (del tipo de evaluación pedido)
    const planesVigencia = await this.obtenerPlanesAprobados(filtros.vigencia_id);
    if (planesVigencia.length === 0) return [];

    const auditoriaMap = await this.construirMapAuditoriasGestion(
      this.extraerAuditoriaIds(planesVigencia),
    );
    let planes = planesVigencia.filter(
      (p) =>
        auditoriaMap.get(this.idDeRef(p.auditoria_id) ?? '')
          ?.tipo_evaluacion_id === filtros.tipo_evaluacion_id,
    );
    if (planes.length === 0) return [];

    // Auditores del plan: nombres para la tabla e ids para "asignado" y el alcance
    const auditoresPlanMap = await this.construirMapAuditoresDelPlan(
      planes.map((p) => String(p._id)),
    );
    const esAuditorDelPlan = (planId: string, personaId: number) =>
      (auditoresPlanMap.get(planId) ?? []).some((a) => a.id === personaId);

    if (alcance.tipo === 'auditor' && alcance.alcance === 'asignadas') {
      const auditoriasDelAuditor = await this.construirMapAuditoresAuditoria(
        this.extraerAuditoriaIds(planes),
      );
      planes = planes.filter((p) => {
        const auditoriaId = this.idDeRef(p.auditoria_id) ?? '';
        return (
          (auditoriasDelAuditor.get(auditoriaId) ?? []).includes(
            alcance.personaId,
          ) || esAuditorDelPlan(String(p._id), alcance.personaId)
        );
      });
      if (planes.length === 0) return [];
    }

    const planMap = new Map<string, any>(planes.map((p) => [String(p._id), p]));
    let acciones = await this.obtenerAccionesDePlanes([...planMap.keys()]);
    if (acciones.length === 0) return [];

    const responsablesMap = await this.construirMapResponsablesDetalle(
      acciones.map((a) => String(a._id)),
    );
    if (dependenciasAuditado) {
      acciones = acciones.filter((a) =>
        [...(responsablesMap.get(String(a._id))?.dependenciaIds ?? [])].some(
          (id) => dependenciasAuditado.has(id),
        ),
      );
      if (acciones.length === 0) return [];
    }

    const accionIds = acciones.map((a) => String(a._id));
    const [soportesMap, calificacionesMap, tiposEvaluacionMap] =
      await Promise.all([
        this.construirMapSoportes(accionIds),
        this.construirMapCalificaciones(accionIds),
        this.construirMapTiposEvaluacion(),
      ]);

    const hoy = new Date();
    const filas = acciones.map((accion) => {
      const accionId = String(accion._id);
      const planId = this.idDeRef(accion.plan_mejoramiento_id) ?? '';
      const auditoriaId = this.idDeRef(planMap.get(planId)?.auditoria_id) ?? '';
      const auditoria = auditoriaMap.get(auditoriaId);
      const hallazgo = this.refPopulada(accion.hallazgo_id);
      const responsables = responsablesMap.get(accionId);
      const calificacion = calificacionesMap.get(accionId);

      const datos: DatosClasificacion = {
        en_revision: accion.en_revision === true,
        total_soportes: soportesMap.get(accionId) ?? 0,
        calificacion: calificacion?.calificacion ?? null,
        fecha_fin: accion.fecha_fin ?? null,
      };

      const fila: FilaGestionAccion = {
        accion_id: accionId,
        plan_mejoramiento_id: planId,
        auditoria_id: auditoriaId,
        no_auditoria: auditoria?.no ?? '',
        nombre_auditoria: auditoria?.nombre ?? '',
        tipo_evaluacion_nombre:
          tiposEvaluacionMap.get(auditoria?.tipo_evaluacion_id ?? -1) ?? '',
        no_hallazgo: hallazgo?.no_hallazgo ?? '',
        descripcion_hallazgo: hallazgo?.descripcion ?? '',
        no_accion: accion.no_accion ?? '',
        tipo_accion_nombre: ACCION_MEJORA.TIPOS[accion.tipo_id] ?? '',
        descripcion_accion: accion.descripcion ?? '',
        dependencia_lider: (responsables?.lider ?? []).join(', '),
        dependencias_apoyo: responsables?.apoyo ?? [],
        auditores_plan: (auditoresPlanMap.get(planId) ?? []).map(
          (a) => a.nombre,
        ),
        fecha_inicio: accion.fecha_inicio ?? null,
        fecha_fin: accion.fecha_fin ?? null,
        en_revision: datos.en_revision,
        total_soportes: datos.total_soportes,
        calificacion: datos.calificacion,
        fecha_calificacion: calificacion?.fecha_calificacion ?? null,
        ...clasificarAccion(datos, hoy),
        auditor_plan_asignado:
          alcance.tipo === 'auditor' &&
          esAuditorDelPlan(planId, alcance.personaId),
      };
      return fila;
    });

    const comparar = (a: string, b: string) =>
      a.localeCompare(b, 'es', { numeric: true });
    return filas.sort(
      (a, b) =>
        comparar(a.no_auditoria, b.no_auditoria) ||
        comparar(a.no_hallazgo, b.no_hallazgo) ||
        comparar(a.no_accion, b.no_accion),
    );
  }

  private aplicarFiltrosGestion(
    filas: FilaGestionAccion[],
    f: FiltrosGestion,
  ): FilaGestionAccion[] {
    // "hasta" llega como fecha sin hora: se incluye el día completo
    const hasta = f.hasta
      ? new Date(f.hasta.length === 10 ? `${f.hasta}T23:59:59.999Z` : f.hasta)
      : null;

    return filas.filter((fila) => {
      if (f.grupo === 'EN_RIESGO' && !fila.en_riesgo) return false;
      if (f.grupo && f.grupo !== 'EN_RIESGO' && fila.grupo !== f.grupo)
        return false;
      if (f.no_auditoria && !this.incluye(fila.no_auditoria, f.no_auditoria))
        return false;
      if (
        f.accion_hallazgo &&
        !this.incluye(fila.no_accion, f.accion_hallazgo) &&
        !this.incluye(fila.no_hallazgo, f.accion_hallazgo)
      )
        return false;
      if (
        f.dependencia &&
        !this.incluye(
          [fila.dependencia_lider, ...fila.dependencias_apoyo]
            .filter(Boolean)
            .join(', '),
          f.dependencia,
        )
      )
        return false;
      if (f.auditor && !this.incluye(fila.auditores_plan.join(', '), f.auditor))
        return false;
      // El cronograma de la acción debe solaparse con el rango pedido
      if (
        f.desde &&
        (!fila.fecha_fin || new Date(fila.fecha_fin) < new Date(f.desde))
      )
        return false;
      if (
        hasta &&
        (!fila.fecha_inicio || new Date(fila.fecha_inicio) > hasta)
      )
        return false;
      return true;
    });
  }

  private parsearFiltrosGestion(query: any): FiltrosGestion {
    const grupo = String(query?.grupo ?? '').trim();
    return {
      vigencia_id: query?.vigencia_id ? Number(query.vigencia_id) : 0,
      tipo_evaluacion_id: query?.tipo_evaluacion_id
        ? Number(query.tipo_evaluacion_id)
        : 0,
      alcance: query?.alcance === 'todas' ? 'todas' : 'asignadas',
      grupo: GRUPOS_VALIDOS.includes(grupo)
        ? (grupo as FiltrosGestion['grupo'])
        : undefined,
      no_auditoria: query?.no_auditoria?.trim() || undefined,
      accion_hallazgo: query?.accion_hallazgo?.trim() || undefined,
      dependencia: query?.dependencia?.trim() || undefined,
      auditor: query?.auditor?.trim() || undefined,
      desde: query?.desde || undefined,
      hasta: query?.hasta || undefined,
      limit: query?.limit != null ? Number(query.limit) : undefined,
      offset: query?.offset != null ? Number(query.offset) : undefined,
    };
  }

  /** Divide los ids en lotes de TAMANO_LOTE para no exceder la URL en consultas __in. */
  private async enLotes(
    ids: string[],
    consulta: (lote: string[]) => Promise<any[]>,
  ): Promise<any[]> {
    const lotes: string[][] = [];
    for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
      lotes.push(ids.slice(i, i + TAMANO_LOTE));
    }
    return (await Promise.all(lotes.map(consulta))).flat();
  }

  private async obtenerPlanesAprobados(vigenciaId: number): Promise<any[]> {
    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento',
      null,
      {
        query: `vigencia_id:${vigenciaId},activo:true,estado_id__in:${PLAN_MEJORAMIENTO_ESTADO.APROBADO_PLAN_MEJORAMIENTO}|${PLAN_MEJORAMIENTO_ESTADO.FIN_PLAN_MEJORAMIENTO}`,
        fields: '_id,auditoria_id,estado_id',
        limit: 0,
      },
    );
    return res?.Data ?? [];
  }

  private async obtenerAccionesDePlanes(planIds: string[]): Promise<any[]> {
    return this.enLotes(planIds, async (lote) => {
      const res = await this.auditoriaCrudService.traerDataCrud(
        'accion-mejora',
        null,
        {
          query: `plan_mejoramiento_id__in:${lote.join('|')},activo:true`,
          populate: 'true',
          limit: 0,
        },
      );
      return res?.Data ?? [];
    });
  }

  /** Número, nombre y tipo de evaluación de cada auditoría (el título y el tipo viven en la auditoría padre). */
  private async construirMapAuditoriasGestion(
    auditoriaIds: string[],
  ): Promise<Map<string, DatosAuditoria>> {
    const map = new Map<string, DatosAuditoria>();

    await Promise.all(
      auditoriaIds.map(async (auditoriaId) => {
        try {
          const auditoriaRes = await this.auditoriaCrudService.traerDataCrud(
            'auditoria',
            auditoriaId,
            null,
          );
          const auditoria = auditoriaRes?.Data;
          if (!auditoria) return;

          let padre: any = null;
          if (auditoria.auditoria_padre_id) {
            const padreRes = await this.auditoriaCrudService.traerDataCrud(
              'auditoria-padre',
              String(this.idDeRef(auditoria.auditoria_padre_id)),
              null,
            );
            padre = padreRes?.Data ?? null;
          }

          const tipo = auditoria.tipo_evaluacion_id ?? padre?.tipo_evaluacion_id;
          map.set(auditoriaId, {
            no:
              auditoria.consecutivo_no_auditoria != null
                ? String(auditoria.consecutivo_no_auditoria)
                : '',
            nombre: padre?.titulo ?? auditoria.titulo ?? '',
            tipo_evaluacion_id: tipo != null ? Number(tipo) : null,
          });
        } catch {
          // auditoría no resoluble: se descarta junto con sus planes
        }
      }),
    );
    return map;
  }

  /** ids de los auditores asignados a cada auditoría. */
  private async construirMapAuditoresAuditoria(
    auditoriaIds: string[],
  ): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    const auditores = await this.enLotes(auditoriaIds, async (lote) => {
      const res = await this.auditoriaCrudService.traerDataCrud('auditor', null, {
        query: `auditoria_id__in:${lote.join('|')},activo:true,asignado:true`,
        fields: 'auditoria_id,auditor_id',
        limit: 0,
      });
      return res?.Data ?? [];
    });

    for (const a of auditores) {
      const auditoriaId = this.idDeRef(a.auditoria_id);
      if (!auditoriaId) continue;
      map.set(auditoriaId, [
        ...(map.get(auditoriaId) ?? []),
        Number(a.auditor_id),
      ]);
    }
    return map;
  }

  /** Auditores (id y nombre) de cada plan. */
  private async construirMapAuditoresDelPlan(
    planIds: string[],
  ): Promise<Map<string, AuditorPlan[]>> {
    const map = new Map<string, AuditorPlan[]>();
    const auditores = await this.enLotes(planIds, async (lote) => {
      const res = await this.auditoriaCrudService.traerDataCrud(
        'plan-mejoramiento-auditor',
        null,
        {
          query: `plan_mejoramiento_id__in:${lote.join('|')},activo:true`,
          limit: 0,
        },
      );
      return res?.Data ?? [];
    });
    if (auditores.length === 0) return map;

    const nombrePorAuditor = new Map<number, string>();
    await Promise.all(
      [...new Set(auditores.map((a) => a.auditor_id).filter(Boolean))].map(
        async (auditorId: number) => {
          const tercero = await this.tercerosHelper.getTerceroById(
            String(auditorId),
          );
          nombrePorAuditor.set(
            auditorId,
            tercero?.NombreCompleto ?? `Auditor ${auditorId}`,
          );
        },
      ),
    );

    for (const a of auditores) {
      const planId = this.idDeRef(a.plan_mejoramiento_id);
      if (!planId || a.auditor_id == null) continue;
      map.set(planId, [
        ...(map.get(planId) ?? []),
        {
          id: Number(a.auditor_id),
          nombre: nombrePorAuditor.get(a.auditor_id) ?? '',
        },
      ]);
    }
    return map;
  }

  /** Dependencia líder, de apoyo y ids de dependencia de cada acción. */
  private async construirMapResponsablesDetalle(
    accionIds: string[],
  ): Promise<Map<string, ResponsablesAccion>> {
    const map = new Map<string, ResponsablesAccion>();
    const responsables = await this.enLotes(accionIds, async (lote) => {
      const res = await this.auditoriaCrudService.traerDataCrud(
        'responsable-accion',
        null,
        {
          query: `accion_mejora_id__in:${lote.join('|')},activo:true`,
          limit: 0,
        },
      );
      return res?.Data ?? [];
    });
    if (responsables.length === 0) return map;

    const dominio = await firstValueFrom(this.dominiosService.getDependencias());
    const nombrePorDependencia = new Map<number, string>(
      dominio.parametros.map((dep: any) => [dep.Id, dep.Nombre]),
    );

    for (const r of responsables) {
      const accionId = this.idDeRef(r.accion_mejora_id);
      if (!accionId) continue;
      const entrada = map.get(accionId) ?? {
        lider: [],
        apoyo: [],
        dependenciaIds: new Set<number>(),
      };
      entrada.dependenciaIds.add(Number(r.dependencia_id));
      const nombre = nombrePorDependencia.get(r.dependencia_id);
      if (nombre) {
        (r.dependencia_lider === true ? entrada.lider : entrada.apoyo).push(
          nombre,
        );
      }
      map.set(accionId, entrada);
    }
    return map;
  }

  /** Cantidad de soportes de avance activos por acción. */
  private async construirMapSoportes(
    accionIds: string[],
  ): Promise<Map<string, number>> {
    const documentos = await this.enLotes(accionIds, async (lote) => {
      const res = await this.auditoriaCrudService.traerDataCrud(
        'documento',
        null,
        {
          query: `referencia_id__in:${lote.join('|')},tipo_id:${ACCION_MEJORA.TIPO_DOCUMENTO_SOPORTE_AVANCE},activo:true`,
          fields: 'referencia_id',
          limit: 0,
        },
      );
      return res?.Data ?? [];
    });

    const map = new Map<string, number>();
    for (const d of documentos) {
      const accionId = this.idDeRef(d.referencia_id);
      if (accionId) map.set(accionId, (map.get(accionId) ?? 0) + 1);
    }
    return map;
  }

  /** Calificación actual de cada acción (la más reciente si hubiera varias). */
  private async construirMapCalificaciones(
    accionIds: string[],
  ): Promise<Map<string, { calificacion: number; fecha_calificacion: string }>> {
    const calificaciones = await this.enLotes(accionIds, async (lote) => {
      const res = await this.auditoriaCrudService.traerDataCrud(
        'calificacion-accion',
        null,
        {
          query: `accion_mejora_id__in:${lote.join('|')},actual:true`,
          fields: 'accion_mejora_id,calificacion,fecha_calificacion',
          limit: 0,
        },
      );
      return res?.Data ?? [];
    });

    const map = new Map<
      string,
      { calificacion: number; fecha_calificacion: string }
    >();
    for (const c of calificaciones) {
      const accionId = this.idDeRef(c.accion_mejora_id);
      if (!accionId || c.calificacion == null) continue;
      const anterior = map.get(accionId);
      if (
        !anterior ||
        new Date(c.fecha_calificacion) > new Date(anterior.fecha_calificacion)
      ) {
        map.set(accionId, {
          calificacion: Number(c.calificacion),
          fecha_calificacion: c.fecha_calificacion,
        });
      }
    }
    return map;
  }

  private async construirMapTiposEvaluacion(): Promise<Map<number, string>> {
    const dominio = await firstValueFrom(
      this.dominiosService.getParametros(TIPO_PARAMETRO.TIPO_EVALUACION),
    );
    return new Map<number, string>(
      (dominio.parametros as any[]).map((p) => [p.Id, p.Nombre]),
    );
  }

  private respuesta<T>(data: T[], count: number) {
    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de acciones exitosa.',
      Data: data,
      MetaData: { Count: count },
    };
  }
}
