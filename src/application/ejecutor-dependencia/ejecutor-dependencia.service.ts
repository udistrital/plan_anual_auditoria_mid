import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { TercerosService } from 'src/shared/services/terceros.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import {
  FilaDependenciaEjecutor,
  FiltrosEjecutor,
  PlanDependencia,
} from './ejecutor-dependencia.model';

const { TIPO_PARAMETRO } = environment;

/**
 * Consolida la información del submódulo "Ejecutor por dependencia" (issue SÍSIFO v2):
 * combina las colecciones ejecutor_dependencia / ejecutor_plan del CRUD con los
 * nombres de dependencia (OIKOS) y de usuario (TERCEROS), evitando que el frontend
 * tenga que orquestar varias llamadas.
 */
@Injectable()
export class EjecutorDependenciaService {
  /** Catálogos de parámetros cacheados tras la primera carga. */
  private readonly vigencias: any[] = [];
  private readonly estados: any[] = [];

  constructor(
    private readonly crud: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
    private readonly tercerosService: TercerosService,
    private readonly dominiosService: DominiosService,
  ) {}

  // ── Consulta de ejecutores por dependencia ────────────────

  /**
   * Lista las dependencias con su(s) ejecutor(es) vigente(s), enriquecidas con
   * el nombre de la dependencia y de cada usuario.
   */
  async getEjecutores(query: any) {
    const filtros = this.parsearFiltros(query);

    const registros = await this.consultarAsignacionesVigentes(filtros);
    const [nombrePorDependencia, datosPorUsuario] = await Promise.all([
      this.mapaNombresDependencia(),
      this.mapaDatosUsuario(registros.map((r) => r.usuario_id)),
    ]);

    const filas = this.agruparPorDependencia(
      registros,
      nombrePorDependencia,
      datosPorUsuario,
    );

    const filtradas = this.filtrarYPaginar(filas, filtros);
    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de ejecutores exitosa.',
      Data: filtradas.pagina,
      MetaData: { Count: filtradas.total },
    };
  }

  /** Asignaciones vigentes (actual:true, activo:true) desde el CRUD. */
  private async consultarAsignacionesVigentes(
    filtros: FiltrosEjecutor,
  ): Promise<any[]> {
    const condiciones = ['actual:true', 'activo:true'];
    if (filtros.dependencia_id) {
      condiciones.push(`dependencia_id:${filtros.dependencia_id}`);
    }
    if (filtros.usuario_id) {
      condiciones.push(`usuario_id:${filtros.usuario_id}`);
    }

    const res = await this.crud.traerDataCrud('ejecutor-dependencia', null, {
      query: condiciones.join(','),
      sortby: 'dependencia_id',
      order: 'asc',
      limit: 0,
    });
    return res?.Data ?? [];
  }

  /** Agrupa los registros planos del CRUD por dependencia. */
  private agruparPorDependencia(
    registros: any[],
    nombrePorDependencia: Map<number, string>,
    datosPorUsuario: Map<
      number,
      { nombre: string; correo: string | null; documento: string | null }
    >,
  ): FilaDependenciaEjecutor[] {
    const porDependencia = new Map<number, FilaDependenciaEjecutor>();

    for (const r of registros) {
      if (!porDependencia.has(r.dependencia_id)) {
        porDependencia.set(r.dependencia_id, {
          dependencia_id: r.dependencia_id,
          dependencia_nombre:
            nombrePorDependencia.get(r.dependencia_id) ??
            `Dependencia ${r.dependencia_id}`,
          ejecutores: [],
          sin_asignar: false,
        });
      }
      const datos = datosPorUsuario.get(r.usuario_id);
      porDependencia.get(r.dependencia_id).ejecutores.push({
        _id: String(r._id),
        usuario_id: r.usuario_id,
        usuario_nombre: datos?.nombre ?? `Usuario ${r.usuario_id}`,
        usuario_documento: datos?.documento ?? null,
        usuario_correo: datos?.correo ?? null,
        fecha_asignacion: r.fecha_asignacion ?? null,
      });
    }

    return Array.from(porDependencia.values());
  }

  // ── Planes de mejoramiento de la dependencia ──────────────

  /**
   * Planes de mejoramiento (Fase 4) de una dependencia, resolviendo la cadena del
   * modelo de datos: auditoria_padre.dependencia_id[] -> auditoria.auditoria_padre_id
   * -> plan_mejoramiento.auditoria_id.
   */
  async getPlanesPorDependencia(dependenciaId: number) {
    const planes = await this.resolverPlanesDeDependencia(dependenciaId);
    await this.reemplazarCampos(planes);
    await this.agregarEjecutoresPorPlan(planes);
    return this.respuestaPlanes(planes);
  }

  /**
   * Planes asignados a un ejecutor (vía la tabla puente ejecutor_plan), para la
   * vista "mis planes" del usuario con rol Ejecutor.
   */
  async getPlanesPorEjecutor(usuarioId: number) {
    // 1. Asignaciones de dependencia vigentes del usuario.
    const asignaciones = await this.consultarAsignacionesVigentes({
      usuario_id: usuarioId,
    });
    if (asignaciones.length === 0) {
      return this.respuestaPlanes([]);
    }
    const ejecutorDependenciaIds = asignaciones.map((a) => String(a._id));

    // 2. Planes puente vigentes de esas asignaciones.
    const puente = await this.crud.traerDataCrud('ejecutor-plan', null, {
      query: `ejecutor_dependencia_id__in:${ejecutorDependenciaIds.join('|')},actual:true,activo:true`,
      fields: 'plan_mejoramiento_id',
      limit: 0,
    });
    const planIds = [
      ...new Set(
        (puente?.Data ?? [])
          .map((p: any) => this.idDeRef(p.plan_mejoramiento_id))
          .filter(Boolean),
      ),
    ] as string[];
    if (planIds.length === 0) {
      return this.respuestaPlanes([]);
    }

    // 3. Datos de los planes.
    const planes = await this.consultarPlanesPorIds(planIds);
    await this.reemplazarCampos(planes);
    return this.respuestaPlanes(planes);
  }

  private async resolverPlanesDeDependencia(
    dependenciaId: number,
  ): Promise<PlanDependencia[]> {
    // 1. auditoria_padre que contienen la dependencia
    const padresRes = await this.crud.traerDataCrud('auditoria-padre', null, {
      query: `dependencia_id__inarray:${dependenciaId},activo:true`,
      fields: '_id',
      limit: 0,
    });
    const padreIds = (padresRes?.Data ?? []).map((p: any) => String(p._id));
    if (padreIds.length === 0) return [];

    // 2. auditorias hijas de esos auditoria_padre
    const auditoriasRes = await this.crud.traerDataCrud('auditoria', null, {
      query: `auditoria_padre_id__in:${padreIds.join('|')},activo:true`,
      fields: '_id',
      limit: 0,
    });
    const auditoriaIds = (auditoriasRes?.Data ?? []).map((a: any) =>
      String(a._id),
    );
    if (auditoriaIds.length === 0) return [];

    // 3. planes de mejoramiento de esas auditorias
    const planesRes = await this.crud.traerDataCrud('plan-mejoramiento', null, {
      query: `auditoria_id__in:${auditoriaIds.join('|')},activo:true`,
      limit: 0,
    });
    return (planesRes?.Data ?? []).map((p: any) => this.mapearPlan(p));
  }

  private async consultarPlanesPorIds(
    planIds: string[],
  ): Promise<PlanDependencia[]> {
    const res = await this.crud.traerDataCrud('plan-mejoramiento', null, {
      query: `_id__in:${planIds.join('|')},activo:true`,
      limit: 0,
    });
    return (res?.Data ?? []).map((p: any) => this.mapearPlan(p));
  }

  /**
   * Adjunta a cada plan la lista de ejecutores que lo tienen asignado de forma
   * vigente (tabla puente ejecutor_plan), resolviendo el usuario y su nombre a
   * partir de la asignación de dependencia referenciada.
   */
  private async agregarEjecutoresPorPlan(
    planes: PlanDependencia[],
  ): Promise<void> {
    for (const plan of planes) plan.ejecutores = [];
    if (planes.length === 0) return;

    const planIds = planes.map((p) => p.plan_mejoramiento_id);

    // 1. Asignaciones puente vigentes de esos planes.
    const puenteRes = await this.crud.traerDataCrud('ejecutor-plan', null, {
      query: `plan_mejoramiento_id__in:${planIds.join('|')},actual:true,activo:true`,
      fields: '_id,plan_mejoramiento_id,ejecutor_dependencia_id',
      limit: 0,
    });
    const puente: any[] = puenteRes?.Data ?? [];
    if (puente.length === 0) return;

    // 2. Resolver usuario_id de cada ejecutor_dependencia referenciado.
    const edIds = [
      ...new Set(
        puente
          .map((p) => this.idDeRef(p.ejecutor_dependencia_id))
          .filter(Boolean),
      ),
    ] as string[];
    const usuarioPorEd = await this.mapaUsuarioPorEjecutorDependencia(edIds);

    // 3. Datos de los usuarios involucrados.
    const datosPorUsuario = await this.mapaDatosUsuario(
      [...usuarioPorEd.values()].filter((v): v is number => v != null),
    );

    // 4. Agrupar por plan.
    const planPorId = new Map(planes.map((p) => [p.plan_mejoramiento_id, p]));
    for (const asignacion of puente) {
      const planId = this.idDeRef(asignacion.plan_mejoramiento_id);
      const edId = this.idDeRef(asignacion.ejecutor_dependencia_id);
      const plan = planId ? planPorId.get(planId) : undefined;
      if (!plan || !edId) continue;

      const usuarioId = usuarioPorEd.get(edId) ?? null;
      plan.ejecutores.push({
        ejecutor_plan_id: String(asignacion._id),
        ejecutor_dependencia_id: edId,
        usuario_id: usuarioId,
        usuario_nombre:
          usuarioId != null
            ? (datosPorUsuario.get(usuarioId)?.nombre ?? `Usuario ${usuarioId}`)
            : 'Usuario desconocido',
      });
    }
  }

  /** Mapa ejecutor_dependencia._id -> usuario_id. */
  private async mapaUsuarioPorEjecutorDependencia(
    edIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (edIds.length === 0) return map;

    const res = await this.crud.traerDataCrud('ejecutor-dependencia', null, {
      query: `_id__in:${edIds.join('|')},activo:true`,
      fields: '_id,usuario_id',
      limit: 0,
    });
    for (const ed of res?.Data ?? []) {
      if (ed?._id != null && ed?.usuario_id != null) {
        map.set(String(ed._id), Number(ed.usuario_id));
      }
    }
    return map;
  }

  // ── Enriquecimiento de nombres ────────────────────────────

  /** Mapa id -> nombre de todas las dependencias activas (OIKOS). */
  private async mapaNombresDependencia(): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    try {
      const dominio = await firstValueFrom(
        this.dominiosService.getDependencias(),
      );
      for (const dep of (dominio.parametros as any[]) ?? []) {
        if (dep?.Id != null) map.set(Number(dep.Id), dep.Nombre);
      }
    } catch {
      // Si OIKOS no responde se mantienen los placeholders "Dependencia N".
    }
    return map;
  }

  /** Mapa id -> { nombre, correo, documento } de cada usuario ejecutor (TERCEROS). */
  private async mapaDatosUsuario(usuarioIds: number[]): Promise<
    Map<
      number,
      { nombre: string; correo: string | null; documento: string | null }
    >
  > {
    const map = new Map<
      number,
      { nombre: string; correo: string | null; documento: string | null }
    >();
    const unicos = [...new Set(usuarioIds.filter(Boolean))];
    await Promise.all(
      unicos.map(async (usuarioId) => {
        const [tercero, documento] = await Promise.all([
          this.tercerosHelper
            .getTerceroById(String(usuarioId))
            .catch(() => null),
          this.documentoDeTercero(usuarioId),
        ]);
        map.set(usuarioId, {
          nombre: tercero?.NombreCompleto ?? `Usuario ${usuarioId}`,
          correo: tercero?.UsuarioWSO2 ?? null,
          documento,
        });
      }),
    );
    return map;
  }

  /** Número de documento de un tercero (datos_identificacion.Numero). */
  private async documentoDeTercero(
    terceroId: number,
  ): Promise<string | null> {
    try {
      const resp = await this.tercerosService.traerData(
        'datos_identificacion',
        null,
        {
          query: `TerceroId:${terceroId},Activo:true`,
          fields: 'Numero',
          limit: 1,
        },
      );
      const registro = Array.isArray(resp) ? resp[0] : (resp?.Data?.[0] ?? resp);
      return registro?.Numero ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Resuelve los nombres de `vigencia_id` y `estado_id` de cada plan, agregando
   * `vigencia_nombre` y `estado_nombre` sin eliminar los ids (estándar `*_id` +
   * `*_nombre`).
   */
  private async reemplazarCampos(planes: PlanDependencia[]): Promise<void> {
    if (!(await this.identificarCampo(planes))) return;

    for (const plan of planes) {
      if (plan.vigencia_id !== undefined) {
        plan.vigencia_nombre = this.nombreDe(this.vigencias, plan.vigencia_id);
      }
      if (plan.estado_id !== undefined) {
        plan.estado_nombre = this.nombreDe(this.estados, plan.estado_id);
      }
    }
  }

  /**
   * Carga los catálogos de vigencia y estado (cada uno una sola vez) si los
   * planes traen los campos correspondientes, reutilizando
   * `DominiosService.getParametros` (que ya filtra por `Activo:true`).
   */
  private async identificarCampo(planes: PlanDependencia[]): Promise<boolean> {
    const primero = planes?.[0];
    if (!primero) return false;

    try {
      const cargas: Promise<void>[] = [];

      if (primero.vigencia_id !== undefined && this.vigencias.length === 0) {
        cargas.push(
          this.cargarParametros(TIPO_PARAMETRO.VIGENCIA, this.vigencias),
        );
      }
      if (primero.estado_id !== undefined && this.estados.length === 0) {
        cargas.push(
          this.cargarParametros(TIPO_PARAMETRO.AUDITORIA_ESTADO, this.estados),
        );
      }

      await Promise.all(cargas);
      return (
        primero.vigencia_id !== undefined || primero.estado_id !== undefined
      );
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * Trae los parámetros de un tipo vía `DominiosService` y los acumula en el
   * catálogo destino.
   */
  private async cargarParametros(
    tipoParametroId: number,
    destino: any[],
  ): Promise<void> {
    const dominio = await firstValueFrom(
      this.dominiosService.getParametros(tipoParametroId),
    );
    destino.push(...(dominio?.parametros ?? []));
  }

  /** Busca el Nombre de un parámetro por su Id en el catálogo dado. */
  private nombreDe(catalogo: any[], id: number): string | null {
    const encontrado = catalogo.find((p) => p.Id === id);
    return encontrado ? encontrado.Nombre : null;
  }

  // ── Utilidades ────────────────────────────────────────────

  private mapearPlan(p: any): PlanDependencia {
    return {
      plan_mejoramiento_id: String(p._id),
      auditoria_id: this.idDeRef(p.auditoria_id) ?? '',
      vigencia_id: p.vigencia_id,
      fecha_apertura: p.fecha_apertura ?? null,
      fecha_limite: p.fecha_limite ?? null,
      estado_id: p.estado_id,
    };
  }

  private respuestaPlanes(planes: PlanDependencia[]) {
    return {
      Success: true,
      Status: 200,
      Message: 'Consulta de planes exitosa.',
      Data: planes,
      MetaData: { Count: planes.length },
    };
  }

  private filtrarYPaginar(
    filas: FilaDependenciaEjecutor[],
    f: FiltrosEjecutor,
  ): { pagina: FilaDependenciaEjecutor[]; total: number } {
    const busqueda = f.busqueda?.toLowerCase();
    const filtradas = busqueda
      ? filas.filter(
          (fila) =>
            fila.dependencia_nombre.toLowerCase().includes(busqueda) ||
            String(fila.dependencia_id).includes(busqueda),
        )
      : filas;

    return {
      pagina: this.paginar(filtradas, f.limit, f.offset),
      total: filtradas.length,
    };
  }

  private paginar<T>(filas: T[], limit?: number, offset?: number): T[] {
    if (!limit || limit <= 0) return filas;
    const inicio = offset ?? 0;
    return filas.slice(inicio, inicio + limit);
  }

  private parsearFiltros(query: any): FiltrosEjecutor {
    return {
      dependencia_id: query?.dependencia_id
        ? Number(query.dependencia_id)
        : undefined,
      usuario_id: query?.usuario_id ? Number(query.usuario_id) : undefined,
      busqueda: query?.busqueda?.trim() || undefined,
      limit: query?.limit != null ? Number(query.limit) : undefined,
      offset: query?.offset != null ? Number(query.offset) : undefined,
    };
  }

  private idDeRef(ref: any): string | null {
    if (!ref) return null;
    if (typeof ref === 'object') return ref._id ? String(ref._id) : null;
    return String(ref);
  }
}
