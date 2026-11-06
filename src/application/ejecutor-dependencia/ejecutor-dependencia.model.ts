/**
 * Modelos del submódulo "Ejecutor por dependencia" (issue SÍSIFO v2).
 *
 * Se extraen del servicio para dejarlo enfocado en la lógica de orquestación y
 * para seguir la convención de archivos `*.model.ts` del proyecto
 * (ver `src/shared/utils/dominios/dominio.model.ts`).
 */

/** Filtros aceptados por la consulta de ejecutores por dependencia. */
export interface FiltrosEjecutor {
  dependencia_id?: number;
  usuario_id?: number;
  busqueda?: string;
  limit?: number;
  offset?: number;
}

/** Ejecutor vigente de una dependencia, con el nombre del usuario resuelto. */
export interface EjecutorConsolidado {
  _id: string;
  usuario_id: number;
  usuario_nombre: string;
  fecha_asignacion: string | null;
}

/** Dependencia con su(s) ejecutor(es) vigente(s). */
export interface FilaDependenciaEjecutor {
  dependencia_id: number;
  dependencia_nombre: string;
  ejecutores: EjecutorConsolidado[];
  sin_asignar: boolean;
}

/** Ejecutor asignado a un plan concreto (tabla puente ejecutor_plan). */
export interface EjecutorDePlan {
  ejecutor_plan_id: string;
  ejecutor_dependencia_id: string;
  usuario_id: number | null;
  usuario_nombre: string;
}

/** Plan de mejoramiento de una dependencia, enriquecido con nombres. */
export interface PlanDependencia {
  plan_mejoramiento_id: string;
  auditoria_id: string;
  vigencia_id: number;
  /** Nombre de la vigencia resuelto desde el dominio de parámetros. */
  vigencia_nombre?: string | null;
  fecha_apertura: string | null;
  fecha_limite: string | null;
  estado_id: number;
  /** Nombre del estado del plan resuelto desde el dominio AUDITORIA_ESTADO. */
  estado_nombre?: string | null;
  /** Ejecutores asignados a este plan (vigentes en ejecutor_plan). */
  ejecutores?: EjecutorDePlan[];
}
