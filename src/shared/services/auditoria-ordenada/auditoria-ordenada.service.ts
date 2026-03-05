import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import {
  ordenarAuditoriasPorPlan,
  aplicarOrdenamiento,
} from '../../utils/auditoria-ordenamiento.utils';

const { PLAN_AUDITORIA_CRUD_SERVICE } = environment;

/**
 * Servicio compartido para obtener auditorías ordenadas.
 * Permite reutilización sin acoplamiento entre módulos.
 */
@Injectable()
export class AuditoriaOrdenadaService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Obtiene auditorías ordenadas según el plan.
   * @param planAuditoriaId - ID del plan de auditoría
   * @param orderBy - Campo opcional para ordenamiento adicional
   * @param orderDirection - Dirección del ordenamiento (ASC/DESC)
   * @param filtros - Filtros adicionales (ej: tipo_evaluacion_id)
   * @returns Auditorías ordenadas
   */
  async getAuditoriasOrdenadas(
    planAuditoriaId: string,
    orderBy?: string,
    orderDirection?: string,
    filtros?: any,
  ): Promise<any[]> {
    const auditorias = await this.obtenerAuditoriasDeCrud(planAuditoriaId);
    let auditoriasActivas = auditorias.filter((a) => a.activo === true);

    // Aplicar filtro de tipo_evaluacion_id si existe
    if (filtros?.tipo_evaluacion_id) {
      auditoriasActivas = auditoriasActivas.filter(
        (a) => a.tipo_evaluacion_id === parseInt(filtros.tipo_evaluacion_id)
      );
    }

    const plan = await this.obtenerPlan(planAuditoriaId);

    let resultado = ordenarAuditoriasPorPlan(
      auditoriasActivas,
      plan?.auditorias || [],
    );

    if (orderBy) {
      resultado = aplicarOrdenamiento(resultado, orderBy, orderDirection);
    }

    return resultado;
  }

  private async obtenerAuditoriasDeCrud(planId: string): Promise<any[]> {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria?query=plan_auditoria_id:${planId},activo:true&limit=0`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data?.Data || [];
    } catch (error) {
      throw new HttpException(
        'Error al obtener auditorías',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async obtenerPlan(planId: string): Promise<any> {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data?.Data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener el plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
