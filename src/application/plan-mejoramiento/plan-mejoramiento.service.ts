import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';
import {
  AccionNumeracion,
  NumeroAccion,
  generarNumerosAccion,
} from './numeracion-acciones.utils';

const { TIPO_PARAMETRO, PLAN_MEJORAMIENTO_ESTADO } = environment;

interface AccionPlan extends AccionNumeracion {
  no_accion?: string | null;
}

export interface ResumenNumeracion {
  plan_mejoramiento_id: string;
  ya_numerado: boolean;
  acciones: NumeroAccion[];
}

@Injectable()
export class PlanMejoramientoService {
  private estados: { Id: number; Nombre: string }[] = [];
  private vigencias: { Id: number; Nombre: string }[] = [];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    await this.cargarEstados();
    const data = await this.auditoriaCrudService.traerDataCrud('plan-mejoramiento', null, queryParams);
    this.reemplazarCampos(data);
    return data;
  }

  /**
   * Aprueba el plan: primero numera sus acciones (no_accion queda inmutable desde aquí) y
   * luego registra el estado APROBADO. Si la numeración falla el plan no se aprueba; al
   * reintentar se generan los mismos números porque el orden es determinista.
   */
  async aprobar(planId: string, body: any) {
    const plan = await this.obtenerPlan(planId);
    if (plan.estado_id !== PLAN_MEJORAMIENTO_ESTADO.REVISION_PLAN_MEJORAMIENTO_AUDITOR) {
      throw new BadRequestException('El plan de mejoramiento no está en revisión del auditor');
    }

    const acciones = await this.obtenerAcciones(planId);
    const numeros = await this.calcularNumeracion(plan, acciones);
    await this.guardarNumeros(numeros);

    return this.auditoriaCrudService.post('plan-mejoramiento-estado', {
      ...body,
      plan_mejoramiento_id: planId,
      estado_id: PLAN_MEJORAMIENTO_ESTADO.APROBADO_PLAN_MEJORAMIENTO,
    });
  }

  /**
   * Numera las acciones de un plan aprobado (o finalizado) antes de existir la numeración.
   * Si el plan ya está numerado no escribe nada; si lo está parcialmente se rechaza, así
   * nunca se reescribe un número ya asignado.
   */
  async numerarPlanAprobado(planId: string): Promise<ResumenNumeracion> {
    const plan = await this.obtenerPlan(planId);
    const estadosNumerables = [
      PLAN_MEJORAMIENTO_ESTADO.APROBADO_PLAN_MEJORAMIENTO,
      PLAN_MEJORAMIENTO_ESTADO.FIN_PLAN_MEJORAMIENTO,
    ];
    if (!estadosNumerables.includes(plan.estado_id)) {
      throw new BadRequestException('El plan de mejoramiento no está aprobado');
    }

    const acciones = await this.obtenerAcciones(planId);
    if (!acciones.length) {
      throw new BadRequestException('El plan de mejoramiento no tiene acciones');
    }

    const conNumero = acciones.filter((a) => a.no_accion?.trim()).length;
    if (conNumero === acciones.length) {
      return {
        plan_mejoramiento_id: planId,
        ya_numerado: true,
        acciones: acciones.map((a) => ({ accionId: a._id, no_accion: a.no_accion! })),
      };
    }
    if (conNumero > 0) {
      throw new BadRequestException(
        'El plan tiene una numeración parcial de acciones, requiere revisión manual',
      );
    }

    const numeros = await this.calcularNumeracion(plan, acciones);
    await this.guardarNumeros(numeros);
    return { plan_mejoramiento_id: planId, ya_numerado: false, acciones: numeros };
  }

  private async obtenerPlan(planId: string): Promise<any> {
    const res = await this.auditoriaCrudService.traerDataCrud('plan-mejoramiento', planId);
    if (!res?.Data) {
      throw new NotFoundException(`No se encontró el plan de mejoramiento ${planId}`);
    }
    return res.Data;
  }

  private async obtenerAcciones(planId: string): Promise<AccionPlan[]> {
    const res = await this.auditoriaCrudService.traerDataCrud('accion-mejora', null, {
      query: `plan_mejoramiento_id:${planId},activo:true`,
      fields: '_id,hallazgo_id,no_accion',
      limit: 0,
    });
    return (res?.Data ?? []).map((a: any) => ({
      _id: String(a._id),
      hallazgo_id: String(typeof a.hallazgo_id === 'object' ? a.hallazgo_id?._id : a.hallazgo_id),
      no_accion: a.no_accion,
    }));
  }

  // Vigencia, No. auditoría y hallazgos del informe (mismo origen que la tabla del plan en el MF)
  private async calcularNumeracion(plan: any, acciones: AccionPlan[]): Promise<NumeroAccion[]> {
    const auditoriaId = String(
      typeof plan.auditoria_id === 'object' ? plan.auditoria_id?._id : plan.auditoria_id,
    );
    const auditoria = (await this.auditoriaCrudService.traerDataCrud('auditoria', auditoriaId))?.Data;
    if (!auditoria) {
      throw new BadRequestException(`No se encontró la auditoría ${auditoriaId}`);
    }

    const vigencia = await this.obtenerVigencia(auditoria.vigencia_id);
    if (!vigencia) {
      throw new BadRequestException(`No se encontró la vigencia ${auditoria.vigencia_id}`);
    }

    const informe = (
      await this.auditoriaCrudService.traerDataCrud('informe', null, {
        query: `auditoria_id:${auditoriaId},activo:true`,
      })
    )?.Data?.[0];
    if (!informe) {
      throw new BadRequestException(`No se encontró el informe de la auditoría ${auditoriaId}`);
    }

    const hallazgos =
      (
        await this.auditoriaCrudService.traerDataCrud('hallazgo', null, {
          query: `informe_id:${informe._id},activo:true`,
          fields: '_id,no_hallazgo',
          limit: 0,
        })
      )?.Data ?? [];

    try {
      return generarNumerosAccion(
        vigencia,
        auditoria.consecutivo_no_auditoria,
        hallazgos.map((h: any) => ({ _id: String(h._id), no_hallazgo: h.no_hallazgo })),
        acciones,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Secuencial para no saturar el CRUD; un fallo detiene el proceso antes de cambiar el estado
  private async guardarNumeros(numeros: NumeroAccion[]): Promise<void> {
    for (const { accionId, no_accion } of numeros) {
      await this.auditoriaCrudService.put('accion-mejora', accionId, { no_accion });
    }
  }

  private async obtenerVigencia(vigenciaId: number): Promise<string | null> {
    if (!this.vigencias.length) {
      const dominio = await firstValueFrom(
        this.dominiosService.getParametros(TIPO_PARAMETRO.VIGENCIA),
      );
      this.vigencias = dominio.parametros as { Id: number; Nombre: string }[];
    }
    return this.vigencias.find((v) => v.Id === vigenciaId)?.Nombre ?? null;
  }

  private async cargarEstados(): Promise<void> {
    if (this.estados.length) return;
    const dominio = await firstValueFrom(
      this.dominiosService.getParametros(TIPO_PARAMETRO.AUDITORIA_ESTADO),
    );
    this.estados = dominio.parametros as { Id: number; Nombre: string }[];
  }

  private reemplazarCampos(data: any): void {
    const procesar = (elemento: any) => {
      if (elemento?.estado_id !== undefined) {
        this.reemplazar(this.estados, elemento, 'estado_id');
      }
    };
    if (Array.isArray(data?.Data)) {
      data.Data.forEach(procesar);
    } else if (typeof data?.Data === 'object' && data.Data !== null) {
      procesar(data.Data);
    }
  }

  private reemplazar(array: { Id: number; Nombre: string }[], elemento: any, campo: string): void {
    const value = elemento[campo];
    const nuevoCampo = campo.replace('_id', '_nombre');
    const encontrado = array.find((p) => p.Id === value);
    elemento[nuevoCampo] = encontrado ? encontrado.Nombre : null;
  }
}
