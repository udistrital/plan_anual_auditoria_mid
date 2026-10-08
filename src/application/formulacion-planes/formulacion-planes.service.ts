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
} = environment;

/** Agrupación de estados del plan que usan los indicadores de la vista. */
const ESTADOS_POR_GRUPO = {
  sin_formular: [ESTADO.SIN_PLAN_MEJORAMIENTO],
  en_formulacion: [
    ESTADO.CREANDO_PLAN_MEJORAMIENTO,
    ESTADO.RECHAZADO_PLAN_MEJORAMIENTO,
  ],
  en_revision: [ESTADO.REVISION_PLAN_MEJORAMIENTO_AUDITOR],
  aprobados: [ESTADO.APROBADO_PLAN_MEJORAMIENTO, ESTADO.FIN_PLAN_MEJORAMIENTO],
};

interface FiltrosFormulacion {
  vigencia_id: number;
  tipo_evaluacion_id: number;
  estado_ids: number[];
  busqueda?: string;
  limit?: number;
  offset?: number;
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

@Injectable()
export class FormulacionPlanesService {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
    private readonly dominiosService: DominiosService,
  ) {}

  /** Conteos de la vigencia para los indicadores y los chips de acceso rápido. */
  async getResumen(personaId: number, cargoId: number, query: any) {
    const { total_auditorias, por_estado } = await this.consultarConteos(
      personaId,
      cargoId,
      this.parsearFiltros(query),
    );
    // El CRUD cuenta; aquí solo se suman sus conteos según el grupo de cada estado
    const cantidadPorEstado = new Map<number | null, number>(
      por_estado.map((e) => [e.estado_id, e.cantidad]),
    );
    const sumar = (estados: (number | null)[]) =>
      estados.reduce((total, e) => total + (cantidadPorEstado.get(e) ?? 0), 0);

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

  /** Conteo de auditorías finalizadas por estado de su plan, calculado en el CRUD. */
  private async consultarConteos(
    personaId: number,
    cargoId: number,
    filtros: FiltrosFormulacion,
  ): Promise<{
    total_auditorias: number;
    por_estado: { estado_id: number | null; cantidad: number }[];
  }> {
    const vacio = { total_auditorias: 0, por_estado: [] };
    if (!filtros.vigencia_id || !filtros.tipo_evaluacion_id) return vacio;

    const dependenciaIds = await this.tercerosHelper.getDependenciasByPersona(
      personaId,
      cargoId,
    );
    if (!dependenciaIds?.length) return vacio;

    const res = await this.auditoriaCrudService.traerDataCrud(
      'resumen-plan-mejoramiento',
      null,
      {
        vigencia_id: filtros.vigencia_id,
        tipo_evaluacion_id: filtros.tipo_evaluacion_id,
        dependencia_ids: dependenciaIds.join('|'),
        estado_auditoria_id: AUDITORIA_ESTADO.APROBADO_INFORME_FINAL_JEFE,
      },
    );
    return res?.Data ?? vacio;
  }

  /** Auditorías finalizadas del auditado con el estado de su plan, filtradas y paginadas. */
  async getAll(personaId: number, cargoId: number, query: any) {
    const filtros = this.parsearFiltros(query);
    const filas = await this.construirFilas(personaId, cargoId, filtros);

    const filtradas = this.aplicarFiltrosEnMemoria(filas, filtros);
    const total = filtradas.length;
    const paginadas = this.paginar(filtradas, filtros.limit, filtros.offset);

    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de auditorías exitosa.',
      Data: paginadas,
      MetaData: { Count: total },
    };
  }

  private async construirFilas(
    personaId: number,
    cargoId: number,
    filtros: FiltrosFormulacion,
  ): Promise<FilaFormulacion[]> {
    if (!filtros.vigencia_id || !filtros.tipo_evaluacion_id) return [];

    // Mismo criterio que la tabla de planes: auditorías de la dependencia con informe final aprobado
    const auditoriasRes = await this.auditoriaService.getByDependencia(
      personaId,
      cargoId,
      {
        query: [
          `vigencia_id:${filtros.vigencia_id}`,
          `tipo_evaluacion_id:${filtros.tipo_evaluacion_id}`,
          'activo:true',
          `estado_id:${AUDITORIA_ESTADO.APROBADO_INFORME_FINAL_JEFE}`,
        ].join(','),
        limit: 0,
      },
    );
    const auditorias: any[] = auditoriasRes?.Data ?? [];
    if (auditorias.length === 0) return [];

    const auditoriaIds = auditorias.map((a) => String(a._id));
    const planPorAuditoria = await this.construirMapPlanes(auditoriaIds);
    const planIds = [...planPorAuditoria.values()].map((p) => String(p._id));

    const [auditoresPorPlan, hallazgosPorAuditoria, rechazosPorPlan, estados] =
      await Promise.all([
        this.construirMapAuditoresPorPlan(planIds),
        this.contarPorReferencia('hallazgo', 'auditoria_id', auditoriaIds),
        this.contarPorReferencia(
          'plan-mejoramiento-estado',
          'plan_mejoramiento_id',
          planIds,
          `estado_id:${ESTADO.RECHAZADO_PLAN_MEJORAMIENTO}`,
        ),
        this.construirMapEstados(),
      ]);

    return auditorias
      .map((auditoria) => {
        const auditoriaId = String(auditoria._id);
        const plan = planPorAuditoria.get(auditoriaId);
        const planId = plan ? String(plan._id) : null;
        const estadoId = plan?.estado_id ?? ESTADO.SIN_PLAN_MEJORAMIENTO;

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
          estado_plan_nombre:
            estados.get(estadoId) ?? 'Sin Plan de Mejoramiento',
          total_hallazgos: hallazgosPorAuditoria.get(auditoriaId) ?? 0,
          total_observaciones: planId ? (rechazosPorPlan.get(planId) ?? 0) : 0,
        };
      })
      .sort((a, b) => Number(a.no_auditoria) - Number(b.no_auditoria));
  }

  /** Plan activo de cada auditoría (el primero, igual que la tabla de planes). */
  private async construirMapPlanes(
    auditoriaIds: string[],
  ): Promise<Map<string, any>> {
    const res = await this.auditoriaCrudService.traerDataCrud(
      'plan-mejoramiento',
      null,
      {
        query: `auditoria_id__in:${auditoriaIds.join('|')},activo:true`,
        fields: '_id,auditoria_id,estado_id',
        limit: 0,
      },
    );
    const map = new Map<string, any>();
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

  private aplicarFiltrosEnMemoria(
    filas: FilaFormulacion[],
    f: FiltrosFormulacion,
  ): FilaFormulacion[] {
    const busqueda = f.busqueda?.toLowerCase();
    return filas.filter(
      (fila) =>
        (!f.estado_ids.length || f.estado_ids.includes(fila.estado_plan_id)) &&
        (!busqueda ||
          `${fila.dependencia_nombre} ${fila.titulo}`
            .toLowerCase()
            .includes(busqueda)),
    );
  }

  private paginar(
    filas: FilaFormulacion[],
    limit?: number,
    offset?: number,
  ): FilaFormulacion[] {
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
