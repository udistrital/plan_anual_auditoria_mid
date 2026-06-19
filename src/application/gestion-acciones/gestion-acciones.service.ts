import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const { TIPO_PARAMETRO } = environment;

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

  private paginar(
    filas: FilaAccion[],
    limit?: number,
    offset?: number,
  ): FilaAccion[] {
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

  private respuesta(data: FilaAccion[], count: number) {
    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de acciones exitosa.',
      Data: data,
      MetaData: { Count: count },
    };
  }
}
