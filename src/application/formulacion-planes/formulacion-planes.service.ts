import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const {
  TIPO_PARAMETRO,
  AUDITORIA_ESTADO,
  PLAN_MEJORAMIENTO_ESTADO: ESTADO,
  ACCION_MEJORA_ESTADO,
} = environment;

/** Agrupación de estados del plan que usan los indicadores de la vista del auditado. */
const ESTADOS_POR_GRUPO = {
  sin_formular: [ESTADO.SIN_PLAN_MEJORAMIENTO],
  en_formulacion: [
    ESTADO.CREANDO_PLAN_MEJORAMIENTO,
    ESTADO.RECHAZADO_PLAN_MEJORAMIENTO,
  ],
  en_revision: [ESTADO.REVISION_PLAN_MEJORAMIENTO_AUDITOR],
  aprobados: [ESTADO.APROBADO_PLAN_MEJORAMIENTO, ESTADO.FIN_PLAN_MEJORAMIENTO],
};

/** El auditor ve los planes rechazados aparte: son los que tienen observaciones suyas. */
const ESTADOS_POR_GRUPO_AUDITOR = {
  sin_formular: [ESTADO.SIN_PLAN_MEJORAMIENTO],
  en_formulacion: [ESTADO.CREANDO_PLAN_MEJORAMIENTO],
  en_revision: [ESTADO.REVISION_PLAN_MEJORAMIENTO_AUDITOR],
  con_observaciones: [ESTADO.RECHAZADO_PLAN_MEJORAMIENTO],
  aprobados: [ESTADO.APROBADO_PLAN_MEJORAMIENTO, ESTADO.FIN_PLAN_MEJORAMIENTO],
};

/** asignadas: auditorías donde la persona es auditor de la auditoría o del plan. */
export type AlcanceAuditor = 'asignadas' | 'todas';

interface FiltrosFormulacion {
  vigencia_id: number;
  tipo_evaluacion_id: number;
  estado_ids: number[];
  busqueda?: string;
  limit?: number;
  offset?: number;
  alcance: AlcanceAuditor;
}

export interface FilaFormulacion {
  auditoria_id: string;
  no_auditoria: string;
  vigencia_nombre: string;
  titulo: string;
  tipo_evaluacion_nombre: string;
  auditores_auditoria: string[];
  auditores_plan: string[];
  dependencia_nombre: string;
  plan_mejoramiento_id: string | null;
  estado_plan_id: number;
  estado_plan_nombre: string;
  total_hallazgos: number;
  total_observaciones: number;
}

export interface FilaFormulacionAuditor extends FilaFormulacion {
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /** Aprobación del informe final: desde ahí corre la formulación del plan. */
  fecha_aprobacion_informe: string | null;
  /** Plazo de formulación del plan (apertura + 8 días hábiles). */
  fecha_limite: string | null;
  /** Fecha del estado actual del plan (radicación, devolución o aprobación). */
  fecha_estado: string | null;
  total_acciones: number;
  acciones_aprobadas: number;
  asignada: boolean;
}

/** Respuesta de resumen-plan-mejoramiento (CRUD); estado_id null = sin plan activo. */
interface ConteosPorEstado {
  total_auditorias: number;
  por_estado: { estado_id: number | null; cantidad: number }[];
}

const SIN_CONTEOS: ConteosPorEstado = { total_auditorias: 0, por_estado: [] };

interface AuditoriasAuditor {
  /** Auditorías visibles según el alcance pedido. */
  auditorias: any[];
  planPorAuditoria: Map<string, any>;
  asignadas: Set<string>;
}

@Injectable()
export class FormulacionPlanesService {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
    private readonly dominiosService: DominiosService,
  ) {}

  // ── Auditado ──────────────────────────────────────────────

  /** Conteos de la vigencia para los indicadores y los chips de acceso rápido. */
  async getResumen(personaId: number, cargoId: number, query: any) {
    const { total_auditorias, por_estado } = await this.consultarConteos(
      personaId,
      cargoId,
      this.parsearFiltros(query),
    );
    // El CRUD cuenta; aquí solo se suman sus conteos según el grupo de cada estado
    const sumar = this.sumadorPorEstado(
      por_estado.map((e) => [e.estado_id, e.cantidad]),
    );

    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de resumen exitosa.',
      Data: {
        auditorias_finalizadas: total_auditorias,
        // null: auditorías sin plan activo
        sin_formular: sumar([...ESTADOS_POR_GRUPO.sin_formular, null]),
        en_formulacion: sumar(ESTADOS_POR_GRUPO.en_formulacion),
        en_revision: sumar(ESTADOS_POR_GRUPO.en_revision),
        aprobados: sumar(ESTADOS_POR_GRUPO.aprobados),
      },
    };
  }

  /** Conteos del auditado: auditorías de sus dependencias. */
  private async consultarConteos(
    personaId: number,
    cargoId: number,
    filtros: FiltrosFormulacion,
  ): Promise<ConteosPorEstado> {
    if (!filtros.vigencia_id || !filtros.tipo_evaluacion_id) return SIN_CONTEOS;

    const dependenciaIds = await this.tercerosHelper.getDependenciasByPersona(
      personaId,
      cargoId,
    );
    if (!dependenciaIds?.length) return SIN_CONTEOS;

    return this.consultarConteosCrud(filtros, {
      dependencia_ids: dependenciaIds.join('|'),
    });
  }

  /**
   * Conteo de auditorías finalizadas por estado de su plan, calculado en el CRUD.
   * El alcance de cada vista llega en `alcance` (dependencia_ids, auditor_id o ninguno).
   */
  private async consultarConteosCrud(
    filtros: FiltrosFormulacion,
    alcance: { dependencia_ids?: string; auditor_id?: number },
  ): Promise<ConteosPorEstado> {
    const res = await this.auditoriaCrudService.traerDataCrud(
      'resumen-plan-mejoramiento',
      null,
      {
        vigencia_id: filtros.vigencia_id,
        tipo_evaluacion_id: filtros.tipo_evaluacion_id,
        estado_auditoria_id: AUDITORIA_ESTADO.APROBADO_INFORME_FINAL_JEFE,
        ...alcance,
      },
    );
    return res?.Data ?? SIN_CONTEOS;
  }

  /** Auditorías finalizadas del auditado con el estado de su plan, filtradas y paginadas. */
  async getAll(personaId: number, cargoId: number, query: any) {
    const filtros = this.parsearFiltros(query);
    if (!filtros.vigencia_id || !filtros.tipo_evaluacion_id) {
      return this.respuestaFilas([], 0);
    }

    // Mismo criterio que la tabla de planes: auditorías de la dependencia con informe final aprobado
    const auditoriasRes = await this.auditoriaService.getByDependencia(
      personaId,
      cargoId,
      { query: this.queryAuditoriasFinalizadas(filtros), limit: 0 },
    );
    const auditorias: any[] = auditoriasRes?.Data ?? [];
    const planPorAuditoria = await this.construirMapPlanes(
      auditorias.map((a) => String(a._id)),
    );

    const { pagina, total } = this.filtrarYPaginar(
      auditorias,
      planPorAuditoria,
      filtros,
    );
    return this.respuestaFilas(
      await this.construirFilas(pagina, planPorAuditoria),
      total,
    );
  }

  // ── Auditor OCI ───────────────────────────────────────────

  /**
   * Conteos por grupo de estado, calculados en el CRUD con la misma regla de
   * "asignada" que consultarAuditoriasAuditor usa para el listado.
   */
  async getResumenAuditor(personaId: number, query: any) {
    const filtros = this.parsearFiltros(query);
    const { total_auditorias, por_estado } =
      !filtros.vigencia_id || !filtros.tipo_evaluacion_id
        ? SIN_CONTEOS
        : await this.consultarConteosCrud(
            filtros,
            filtros.alcance === 'todas' ? {} : { auditor_id: personaId },
          );
    const sumar = this.sumadorPorEstado(
      por_estado.map((e) => [e.estado_id, e.cantidad]),
    );

    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de resumen exitosa.',
      Data: {
        total_auditorias,
        // null: auditorías sin plan activo
        sin_formular: sumar([...ESTADOS_POR_GRUPO_AUDITOR.sin_formular, null]),
        en_formulacion: sumar(ESTADOS_POR_GRUPO_AUDITOR.en_formulacion),
        en_revision: sumar(ESTADOS_POR_GRUPO_AUDITOR.en_revision),
        con_observaciones: sumar(ESTADOS_POR_GRUPO_AUDITOR.con_observaciones),
        aprobados: sumar(ESTADOS_POR_GRUPO_AUDITOR.aprobados),
      },
    };
  }

  /** Auditorías finalizadas que revisa el auditor, con plazo y avance de dictamen de su plan. */
  async getAllAuditor(personaId: number, query: any) {
    const filtros = this.parsearFiltros(query);
    const { auditorias, planPorAuditoria, asignadas } =
      await this.consultarAuditoriasAuditor(personaId, filtros);

    const { pagina, total } = this.filtrarYPaginar(
      auditorias,
      planPorAuditoria,
      filtros,
    );
    const filas = await this.construirFilas(pagina, planPorAuditoria);
    return this.respuestaFilas(
      await this.agregarDatosAuditor(
        filas,
        pagina,
        planPorAuditoria,
        asignadas,
      ),
      total,
    );
  }

  /**
   * Auditorías finalizadas de la institución, marcando las asignadas a la persona.
   * Con alcance "asignadas" solo devuelve esas. La regla de "asignada" debe coincidir
   * con la de resumen-plan-mejoramiento (CRUD), que calcula los conteos del resumen.
   */
  private async consultarAuditoriasAuditor(
    personaId: number,
    filtros: FiltrosFormulacion,
  ): Promise<AuditoriasAuditor> {
    const vacio: AuditoriasAuditor = {
      auditorias: [],
      planPorAuditoria: new Map(),
      asignadas: new Set(),
    };
    if (!filtros.vigencia_id || !filtros.tipo_evaluacion_id) return vacio;

    const auditoriasRes = await this.auditoriaService.getAll({
      query: this.queryAuditoriasFinalizadas(filtros),
      limit: 0,
    });
    const todas: any[] = auditoriasRes?.Data ?? [];
    if (todas.length === 0) return vacio;

    const planPorAuditoria = await this.construirMapPlanes(
      todas.map((a) => String(a._id)),
    );
    const planesDelAuditor = await this.consultarPlanesDelAuditor(
      personaId,
      [...planPorAuditoria.values()].map((p) => String(p._id)),
    );

    const asignadas = new Set<string>(
      todas
        .filter(
          (a) =>
            (a.auditores ?? []).some(
              (auditor: any) => Number(auditor.auditor_id) === personaId,
            ) ||
            planesDelAuditor.has(
              String(planPorAuditoria.get(String(a._id))?._id),
            ),
        )
        .map((a) => String(a._id)),
    );

    return {
      auditorias:
        filtros.alcance === 'todas'
          ? todas
          : todas.filter((a) => asignadas.has(String(a._id))),
      planPorAuditoria,
      asignadas,
    };
  }

  /** Planes (de los indicados) en los que la persona es auditor asignado. */
  private async consultarPlanesDelAuditor(
    personaId: number,
    planIds: string[],
  ): Promise<Set<string>> {
    if (planIds.length === 0) return new Set();

    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento-auditor',
      null,
      {
        query: `plan_mejoramiento_id__in:${planIds.join('|')},auditor_id:${personaId},activo:true`,
        fields: 'plan_mejoramiento_id',
        limit: 0,
      },
    );
    return new Set(
      (res?.Data ?? [])
        .map((a: any) => this.idDeRef(a.plan_mejoramiento_id))
        .filter(Boolean),
    );
  }

  /** Agrega a las filas de la página las fechas, el plazo y el avance de dictamen. */
  private async agregarDatosAuditor(
    filas: FilaFormulacion[],
    pagina: any[],
    planPorAuditoria: Map<string, any>,
    asignadas: Set<string>,
  ): Promise<FilaFormulacionAuditor[]> {
    const planIds = filas
      .map((f) => f.plan_mejoramiento_id)
      .filter(Boolean) as string[];
    const [aprobacionPorAuditoria, fechaPorPlan, accionesPorPlan] =
      await Promise.all([
        this.construirMapAprobacionInforme(filas.map((f) => f.auditoria_id)),
        this.construirMapFechaEstado(planIds),
        this.contarAccionesPorPlan(planIds),
      ]);
    const auditoriaPorId = new Map(pagina.map((a) => [String(a._id), a]));

    return filas.map((fila) => {
      const auditoria = auditoriaPorId.get(fila.auditoria_id);
      const planId = fila.plan_mejoramiento_id;
      const acciones = planId ? accionesPorPlan.get(planId) : undefined;
      return {
        ...fila,
        fecha_inicio: auditoria?.fecha_inicio ?? null,
        fecha_fin: auditoria?.fecha_fin ?? null,
        fecha_aprobacion_informe:
          aprobacionPorAuditoria.get(fila.auditoria_id) ?? null,
        fecha_limite:
          planPorAuditoria.get(fila.auditoria_id)?.fecha_limite ?? null,
        fecha_estado: planId ? (fechaPorPlan.get(planId) ?? null) : null,
        total_acciones: acciones?.total ?? 0,
        acciones_aprobadas: acciones?.aprobadas ?? 0,
        asignada: asignadas.has(fila.auditoria_id),
      };
    });
  }

  /** Fecha de aprobación del informe final de cada auditoría (la más reciente si hay varias). */
  private async construirMapAprobacionInforme(
    auditoriaIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (auditoriaIds.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud('informe', null, {
      query: `auditoria_id__in:${auditoriaIds.join('|')},activo:true,fecha_aprobacion_informe__isnull:false`,
      fields: 'auditoria_id,fecha_aprobacion_informe',
      limit: 0,
    });
    for (const informe of res?.Data ?? []) {
      const auditoriaId = this.idDeRef(informe.auditoria_id);
      const fecha = informe.fecha_aprobacion_informe;
      if (!auditoriaId || !fecha) continue;
      const anterior = map.get(auditoriaId);
      if (!anterior || new Date(fecha) > new Date(anterior)) {
        map.set(auditoriaId, fecha);
      }
    }
    return map;
  }

  private async construirMapFechaEstado(
    planIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (planIds.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento-estado',
      null,
      {
        query: `plan_mejoramiento_id__in:${planIds.join('|')},actual:true,activo:true`,
        fields: 'plan_mejoramiento_id,fecha_ejecucion_estado',
        limit: 0,
      },
    );
    for (const estado of res?.Data ?? []) {
      const planId = this.idDeRef(estado.plan_mejoramiento_id);
      if (planId && estado.fecha_ejecucion_estado) {
        map.set(planId, estado.fecha_ejecucion_estado);
      }
    }
    return map;
  }

  private async contarAccionesPorPlan(
    planIds: string[],
  ): Promise<Map<string, { total: number; aprobadas: number }>> {
    const map = new Map<string, { total: number; aprobadas: number }>();
    if (planIds.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud(
      'accion-mejora',
      null,
      {
        query: `plan_mejoramiento_id__in:${planIds.join('|')},activo:true`,
        fields: 'plan_mejoramiento_id,estado_id',
        limit: 0,
      },
    );
    for (const accion of res?.Data ?? []) {
      const planId = this.idDeRef(accion.plan_mejoramiento_id);
      if (!planId) continue;
      const conteo = map.get(planId) ?? { total: 0, aprobadas: 0 };
      conteo.total++;
      if (accion.estado_id === ACCION_MEJORA_ESTADO.APROBADA)
        conteo.aprobadas++;
      map.set(planId, conteo);
    }
    return map;
  }

  // ── Comunes ───────────────────────────────────────────────

  private queryAuditoriasFinalizadas(filtros: FiltrosFormulacion): string {
    return [
      `vigencia_id:${filtros.vigencia_id}`,
      `tipo_evaluacion_id:${filtros.tipo_evaluacion_id}`,
      'activo:true',
      `estado_id:${AUDITORIA_ESTADO.APROBADO_INFORME_FINAL_JEFE}`,
    ].join(',');
  }

  /**
   * Filtra, ordena por número de auditoría y pagina antes de armar las filas,
   * para consultar auditores y conteos solo de la página pedida.
   */
  private filtrarYPaginar(
    auditorias: any[],
    planPorAuditoria: Map<string, any>,
    f: FiltrosFormulacion,
  ): { pagina: any[]; total: number } {
    const busqueda = f.busqueda?.toLowerCase();
    const filtradas = auditorias
      .filter((auditoria) => {
        const estadoId = this.estadoDelPlan(
          planPorAuditoria.get(String(auditoria._id)),
        );
        return (
          (!f.estado_ids.length || f.estado_ids.includes(estadoId)) &&
          (!busqueda ||
            `${this.unirTexto(auditoria.dependencia_nombre)} ${auditoria.titulo ?? ''}`
              .toLowerCase()
              .includes(busqueda))
        );
      })
      .sort(
        (a, b) =>
          Number(a.consecutivo_no_auditoria ?? 0) -
          Number(b.consecutivo_no_auditoria ?? 0),
      );

    return {
      pagina: this.paginar(filtradas, f.limit, f.offset),
      total: filtradas.length,
    };
  }

  /** Filas de la tabla, en el mismo orden de las auditorías recibidas. */
  private async construirFilas(
    auditorias: any[],
    planPorAuditoria: Map<string, any>,
  ): Promise<FilaFormulacion[]> {
    if (auditorias.length === 0) return [];

    const auditoriaIds = auditorias.map((a) => String(a._id));
    const planIds = auditoriaIds
      .map((id) => planPorAuditoria.get(id))
      .filter(Boolean)
      .map((p) => String(p._id));

    const [auditoresPorPlan, hallazgosPorAuditoria, rechazosPorPlan, estados] =
      await Promise.all([
        this.construirMapAuditoresPorPlan(planIds),
        // Los hallazgos rechazados en el preinforme no llegan al informe ni al plan.
        this.contarPorReferencia(
          'hallazgo',
          'auditoria_id',
          auditoriaIds,
          'rechazado__not:true',
        ),
        this.contarPorReferencia(
          'plan-mejoramiento-estado',
          'plan_mejoramiento_id',
          planIds,
          `estado_id:${ESTADO.RECHAZADO_PLAN_MEJORAMIENTO}`,
        ),
        this.construirMapEstados(),
      ]);

    return auditorias.map((auditoria) => {
      const auditoriaId = String(auditoria._id);
      const plan = planPorAuditoria.get(auditoriaId);
      const planId = plan ? String(plan._id) : null;
      const estadoId = this.estadoDelPlan(plan);

      return {
        auditoria_id: auditoriaId,
        no_auditoria:
          auditoria.consecutivo_no_auditoria != null
            ? String(auditoria.consecutivo_no_auditoria)
            : '',
        vigencia_nombre: auditoria.vigencia_nombre ?? '',
        titulo: auditoria.titulo ?? '',
        tipo_evaluacion_nombre: auditoria.tipo_evaluacion_nombre ?? '',
        auditores_auditoria: (auditoria.auditores ?? [])
          .map((a: any) => a.auditor_nombre)
          .filter(Boolean),
        auditores_plan: planId ? (auditoresPorPlan.get(planId) ?? []) : [],
        dependencia_nombre: this.unirTexto(auditoria.dependencia_nombre),
        plan_mejoramiento_id: planId,
        estado_plan_id: estadoId,
        estado_plan_nombre: estados.get(estadoId) ?? 'Sin Plan de Mejoramiento',
        total_hallazgos: hallazgosPorAuditoria.get(auditoriaId) ?? 0,
        total_observaciones: planId ? (rechazosPorPlan.get(planId) ?? 0) : 0,
      };
    });
  }

  private respuestaFilas<T>(filas: T[], total: number) {
    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de auditorías exitosa.',
      Data: filas,
      MetaData: { Count: total },
    };
  }

  /** Devuelve una función que suma las cantidades de los estados indicados. */
  private sumadorPorEstado(
    cantidades: [number | null, number][],
  ): (estados: (number | null)[]) => number {
    const cantidadPorEstado = new Map(cantidades);
    return (estados) =>
      estados.reduce((total, e) => total + (cantidadPorEstado.get(e) ?? 0), 0);
  }

  /** Sin plan activo la auditoría cuenta como "Sin plan de mejoramiento". */
  private estadoDelPlan(plan: any): number {
    return plan?.estado_id ?? ESTADO.SIN_PLAN_MEJORAMIENTO;
  }

  /** Plan activo de cada auditoría (el primero, igual que la tabla de planes). */
  private async construirMapPlanes(
    auditoriaIds: string[],
  ): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    if (auditoriaIds.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento',
      null,
      {
        query: `auditoria_id__in:${auditoriaIds.join('|')},activo:true`,
        fields: '_id,auditoria_id,estado_id,fecha_limite',
        limit: 0,
      },
    );
    for (const plan of res?.Data ?? []) {
      const auditoriaId = this.idDeRef(plan.auditoria_id);
      if (auditoriaId && !map.has(auditoriaId)) map.set(auditoriaId, plan);
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
        fields: 'plan_mejoramiento_id,auditor_id',
        limit: 0,
      },
    );
    const auditores: any[] = res?.Data ?? [];

    const nombrePorAuditor = new Map<number, string>();
    await Promise.all(
      [...new Set(auditores.map((a) => a.auditor_id).filter(Boolean))].map(
        async (auditorId) => {
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
      const nombre = nombrePorAuditor.get(a.auditor_id);
      if (!planId || !nombre) continue;
      map.set(planId, [...(map.get(planId) ?? []), nombre]);
    }
    return map;
  }

  /** Cuenta los registros activos de un endpoint del CRUD agrupados por una referencia. */
  private async contarPorReferencia(
    endpoint: string,
    campo: string,
    ids: string[],
    condicionExtra?: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (ids.length === 0) return map;

    const res = await this.auditoriaCrudService.traerDataCrud(endpoint, null, {
      query: [`${campo}__in:${ids.join('|')}`, 'activo:true', condicionExtra]
        .filter(Boolean)
        .join(','),
      fields: campo,
      limit: 0,
    });
    for (const registro of res?.Data ?? []) {
      const id = this.idDeRef(registro[campo]);
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
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

  private paginar<T>(filas: T[], limit?: number, offset?: number): T[] {
    if (!limit || limit <= 0) return filas;
    const inicio = offset ?? 0;
    return filas.slice(inicio, inicio + limit);
  }

  private parsearFiltros(query: any): FiltrosFormulacion {
    return {
      vigencia_id: query?.vigencia_id ? Number(query.vigencia_id) : 0,
      tipo_evaluacion_id: query?.tipo_evaluacion_id
        ? Number(query.tipo_evaluacion_id)
        : 0,
      estado_ids: String(query?.estado_ids ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number),
      busqueda: query?.busqueda?.trim() || undefined,
      limit: query?.limit != null ? Number(query.limit) : undefined,
      offset: query?.offset != null ? Number(query.offset) : undefined,
      alcance: query?.alcance === 'todas' ? 'todas' : 'asignadas',
    };
  }

  /** getByDependencia puede dejar dependencia_nombre como lista o como texto. */
  private unirTexto(valor: string | string[] | null | undefined): string {
    if (Array.isArray(valor)) return valor.filter(Boolean).join(', ');
    return valor ?? '';
  }

  /** Extrae el _id de una referencia que puede venir como string u objeto populado. */
  private idDeRef(ref: any): string | null {
    if (!ref) return null;
    if (typeof ref === 'object') return ref._id ? String(ref._id) : null;
    return String(ref);
  }
}
