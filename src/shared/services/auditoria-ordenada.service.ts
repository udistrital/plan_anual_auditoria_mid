import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  ordenarAuditoriasPorPlan,
  aplicarOrdenamiento,
} from '../utils/auditoria-ordenamiento.utils';
import { AuditoriaCrudService } from './auditoria-crud.service';

/**
 * Servicio compartido para obtener auditorías ordenadas.
 * Permite reutilización sin acoplamiento entre módulos.
 */
@Injectable()
export class AuditoriaOrdenadaService {
  constructor(private readonly auditoriaCrudService: AuditoriaCrudService) {}

  /**
   * Obtiene auditorías ordenadas según el plan.
   * @param planAuditoriaId - ID del plan de auditoría
   * @param orderBy - Campo opcional para ordenamiento adicional
   * @param orderDirection - Dirección del ordenamiento (ASC/DESC)
   * @param filtros - Filtros adicionales (ej: tipo_evaluacion_id)
   * @param tipo - Tipo de auditoría ('auditoria' o 'auditoria-padre')
   * @returns Auditorías ordenadas
   */
  async getAuditoriasOrdenadas(
    planAuditoriaId: string,
    orderBy?: string,
    orderDirection?: string,
    filtros?: any,
    tipo: 'auditoria' | 'auditoria-padre' = 'auditoria',
  ): Promise<any[]> {
    const auditorias = await this.obtenerAuditoriasDeCrud(
      planAuditoriaId,
      tipo,
    );
    let auditoriasActivas = auditorias.filter((a) => a.activo === true);

    if (filtros?.tipo_evaluacion_id) {
      auditoriasActivas = auditoriasActivas.filter(
        (a) => a.tipo_evaluacion_id === parseInt(filtros.tipo_evaluacion_id),
      );
    }

    const plan = await this.obtenerPlan(planAuditoriaId);
    const campoOrden = 'auditorias';

    let resultado = ordenarAuditoriasPorPlan(
      auditoriasActivas,
      plan?.[campoOrden] || [],
    );

    if (orderBy) {
      resultado = aplicarOrdenamiento(resultado, orderBy, orderDirection);
    }

    return resultado;
  }

  /**
   * Obtiene auditorías desde el CRUD usando el servicio centralizado.
   * @param planId - ID del plan
   * @param tipo - Endpoint ('auditoria' o 'auditoria-padre')
   * @returns Lista de auditorías
   */
  private async obtenerAuditoriasDeCrud(
    planId: string,
    tipo: string = 'auditoria',
  ): Promise<any[]> {
    const queryParams = {
      query: `plan_auditoria_id:${planId},activo:true`,
      limit: 0,
    };

    const response = await this.auditoriaCrudService.traerDataCrud(
      tipo,
      null,
      queryParams,
    );

    return response?.Data || [];
  }

  /**
   * Obtiene el plan de auditoría desde el CRUD.
   * @param planId - ID del plan
   * @returns Plan de auditoría
   */
  private async obtenerPlan(planId: string): Promise<any> {
    const response = await this.auditoriaCrudService.traerDataCrud(
      'plan-auditoria',
      planId,
      null,
    );

    return response?.Data;
  }
}
