import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { HallazgoExternoNormalizado } from 'src/shared/utils/validar-hallazgo-externo.util';

const TAMANO_LOTE = 10;

export interface EntradaRegistroExterna {
  auditoria: {
    vigencia_id: number;
    codigo_entidad: string;
    nombre_entidad: string;
    nombre_auditoria: string;
    fecha_informe_final: string;
    dependencia_id: number[];
    estado_id: number;
  };
  hallazgos: HallazgoExternoNormalizado[];
  documento: {
    nuxeo_id: number;
    nuxeo_enlace: string;
    tipo_id: number;
    referencia_tipo: string;
  };
  plan: {
    tipo_evaluacion_id: number;
    estado_id: number;
    fuente: number;
    fase_id: string;
  };
  usuario: { id: number; rol: string };
}

export interface ResultadoRegistroExterna {
  auditoria_externa_id: string;
  plan_mejoramiento_id: string;
}

interface Creado {
  endpoint: string;
  id: string;
}

/**
 * Única clase del MID que habla con el CRUD sobre la auditoría externa (#953): si el modelo
 * de datos cambia, solo se reemplaza esta clase y el contrato con el MF queda igual.
 */
@Injectable()
export class AuditoriaExternaRepositorio {
  private readonly logger = new Logger(AuditoriaExternaRepositorio.name);

  constructor(private readonly crud: AuditoriaCrudService) {}

  /** Auditorías activas de un ente (el código no debe traer `,` ni `:`: lo valida el servicio). */
  async buscarPorEntidad(codigoEntidad: string): Promise<any[]> {
    const respuesta = await this.crud.traerDataCrud('auditoria-externa', null, {
      query: `codigo_entidad:${codigoEntidad},activo:true`,
      limit: 0,
    });
    return respuesta?.Data ?? [];
  }

  /**
   * Guarda todo en orden y, si un paso falla, revierte lo creado (borrado lógico en orden
   * inverso) y lanza `502` indicando que no se guardó nada.
   */
  async crearRegistro(
    entrada: EntradaRegistroExterna,
  ): Promise<ResultadoRegistroExterna> {
    const creados: Creado[] = [];
    let auditoriaId: string | null = null;
    try {
      auditoriaId = await this.crear(creados, 'auditoria-externa', {
        ...entrada.auditoria,
      });
      await this.crear(creados, 'auditoria-externa-estado', {
        auditoria_externa_id: auditoriaId,
        usuario_id: entrada.usuario.id,
        usuario_rol: entrada.usuario.rol,
        observacion: '',
        estado_id: entrada.auditoria.estado_id,
      });
      await this.crud.post('auditoria-externa-hallazgo/lote', {
        auditoria_externa_id: auditoriaId,
        hallazgos: entrada.hallazgos.map((h) => ({
          vigencia_id: h.vigencia_pad,
          codigo_auditoria: h.codigo_auditoria_pad,
          numeral: h.numeral,
          descripcion: h.descripcion,
          dependencia_id: h.dependencia_id,
        })),
      });
      await this.crear(creados, 'documento', {
        referencia_id: auditoriaId,
        referencia_tipo: entrada.documento.referencia_tipo,
        nuxeo_id: entrada.documento.nuxeo_id,
        nuxeo_enlace: entrada.documento.nuxeo_enlace,
        tipo_id: entrada.documento.tipo_id,
        activo: true,
        fecha_creacion: new Date().toISOString(),
      });
      const planId = await this.crear(creados, 'plan-mejoramiento', {
        auditoria_externa_id: auditoriaId,
        vigencia_id: entrada.auditoria.vigencia_id,
        tipo_evaluacion_id: entrada.plan.tipo_evaluacion_id,
        estado_id: entrada.plan.estado_id,
        fuente: entrada.plan.fuente,
        activo: true,
      });
      await this.crear(creados, 'plan-mejoramiento-estado', {
        plan_mejoramiento_id: planId,
        usuario_id: entrada.usuario.id,
        usuario_rol: entrada.usuario.rol,
        observacion: '',
        estado_id: entrada.plan.estado_id,
        fase_id: entrada.plan.fase_id,
        fecha_ejecucion_estado: new Date().toISOString(),
        activo: true,
      });
      await this.crear(creados, 'plan-mejoramiento-auditor', {
        plan_mejoramiento_id: planId,
        auditor_id: entrada.usuario.id,
        asignado: true,
        asignado_por_id: entrada.usuario.id,
        auditor_lider: true,
        activo: true,
      });
      return {
        auditoria_externa_id: auditoriaId,
        plan_mejoramiento_id: planId,
      };
    } catch (error) {
      this.logger.error(
        `Falló el registro de la auditoría externa (${creados.length} pasos creados): ${this.detalle(error)}`,
      );
      await this.compensar(auditoriaId, creados);
      throw new HttpException(
        'No se pudo registrar la auditoría externa en el servicio CRUD. No se guardó nada; intente de nuevo.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Datos completos de una auditoría externa activa, o `null` si no existe. */
  async obtener(id: string) {
    const auditorias = await this.crud.traerDataCrud(
      'auditoria-externa',
      null,
      {
        query: `_id:${id},activo:true`,
        limit: 1,
      },
    );
    const auditoria = auditorias?.Data?.[0];
    if (!auditoria) return null;

    const [hallazgos, documentos, planes] = await Promise.all([
      this.crud.traerDataCrud('auditoria-externa-hallazgo', null, {
        query: `auditoria_externa_id:${id},activo:true`,
        sortby: 'numeral',
        order: 'asc',
        limit: 0,
      }),
      this.crud.traerDataCrud('documento', null, {
        query: `referencia_id:${id},activo:true`,
        limit: 0,
      }),
      this.crud.traerDataCrud('plan-mejoramiento', null, {
        query: `auditoria_externa_id:${id},activo:true`,
        limit: 1,
      }),
    ]);
    return {
      auditoria,
      hallazgos: hallazgos?.Data ?? [],
      documentos: documentos?.Data ?? [],
      plan: planes?.Data?.[0] ?? null,
    };
  }

  async listar(query: Record<string, any>) {
    return this.crud.traerDataCrud('auditoria-externa', null, query);
  }

  private async crear(
    creados: Creado[],
    endpoint: string,
    cuerpo: Record<string, any>,
  ): Promise<string> {
    const respuesta = await this.crud.post(endpoint, cuerpo);
    const id = respuesta?.Data?._id;
    if (!id) {
      throw new Error(`El CRUD no devolvió el id de ${endpoint}`);
    }
    creados.push({ endpoint, id: String(id) });
    return String(id);
  }

  /** Borrado lógico en orden inverso; un fallo al revertir se registra pero no corta el resto. */
  private async compensar(auditoriaId: string | null, creados: Creado[]) {
    for (const creado of [...creados].reverse()) {
      await this.borrarLogico(creado.endpoint, creado.id);
    }
    // El lote pudo crear hallazgos antes de fallar: se buscan por auditoría
    if (!auditoriaId) return;
    try {
      const hallazgos = await this.crud.traerDataCrud(
        'auditoria-externa-hallazgo',
        null,
        {
          query: `auditoria_externa_id:${auditoriaId},activo:true`,
          fields: '_id',
          limit: 0,
        },
      );
      const ids: string[] = (hallazgos?.Data ?? []).map((h: any) =>
        String(h._id),
      );
      for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
        await Promise.all(
          ids
            .slice(i, i + TAMANO_LOTE)
            .map((id) => this.borrarLogico('auditoria-externa-hallazgo', id)),
        );
      }
    } catch (error) {
      this.logger.error(
        `No se pudieron revertir los hallazgos de ${auditoriaId}: ${this.detalle(error)}`,
      );
    }
  }

  private async borrarLogico(endpoint: string, id: string) {
    try {
      await this.crud.delete(endpoint, id);
    } catch (error) {
      this.logger.error(
        `No se pudo revertir ${endpoint}/${id}: ${this.detalle(error)}`,
      );
    }
  }

  private detalle(error: any): string {
    return String(error?.response?.data?.Data ?? error?.message ?? error);
  }
}
