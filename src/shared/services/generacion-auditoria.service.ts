import { Injectable, BadRequestException } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';

const { TIPO_EVALUACION, MESES} = environment;

interface GenerarAuditoriaDto {
  usuario_id: number;
  usuario_rol: string;
  observacion: string;
  estado_id_padre_actual?: number;
  estado_id_padre_nuevo: number;
  estado_id_hija_nuevo: number;
  fase_id: number;
}

@Injectable()
export class GeneracionAuditoriaService { 

    private readonly MESES_MAP: Record<number, string> =
    Object.entries(MESES).reduce(
        (acc, [nombre, id]) => {
        acc[Number(id)] = nombre;
        return acc;
        },
        {} as Record<number, string>,
    );


  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
  ) {}

  /**
   * Genera auditorías hijas para las auditorías padre de un plan anual de auditorias.
   * Orquesta la creación de auditorías hijas, sus estados y actualiza el estado padre.
   * @param planAuditoriaId ID del plan de auditoría
   * @param generarAuditoriaDto DTO con información para generar auditorías
   * @returns Resultado de la operación con las auditorías creadas
   */
  async generarAuditorias(
    planAuditoriaId: string,
    generarAuditoriaDto: GenerarAuditoriaDto,
  ): Promise<any> {
      // 1. Obtener todas las auditorías padre del plan
      const response = await this.auditoriaCrudService.traerDataCrud(
        'auditoria-padre',
        null,
        {
          query: `plan_auditoria_id:${planAuditoriaId},activo:true`,
          limit: 0,
        },
      );
  
      const auditoriasPadre = response.Data || [];
  
      if (!auditoriasPadre.length) {
        throw new BadRequestException(
          `No se encontraron auditorías padre para el plan ${planAuditoriaId}`,
        );
      }

      // 2. Procesar cada auditoría padre
      const resultados = [];

      for (const auditoriaPadre of auditoriasPadre) {

      const resultado =
          await this.generarAuditoriasParaPadre(
            auditoriaPadre,
            generarAuditoriaDto,
          );

        resultados.push(resultado);
      }
        
      return {
        Success: true,
        Status: 201,
        Message: 'Auditorías generadas exitosamente',
        Data: {
          totalAuditoriasCreadas: resultados.reduce(
            (sum, r) => sum + r.auditoriasCreadas,
            0,
          ),
          detallesPorPadre: resultados,
        },
      };
  }

  /**
   * Genera una auditoría hija a partir de una auditoría padre, si el número de auditorías hijas existentes es menor que la cantidad_auditoria especificada en la auditoría padre.
   * @param id Id de la auditoría padre para la cual se generará la auditoría hija.
   * @param generarAuditoriaDto DTO con la información necesaria para la generación de la auditoría hija y su estado, así como para la actualización del estado de la auditoría padre.
   * @returns Auditoría hija generada.
   * @throws Error si la auditoría padre no existe.
   * @throws Error si la auditoría padre no tiene una cantidad de auditorías asignada.
   */
  async generarUnaAuditoria(
    auditoriaPadreId: string,
    generarAuditoriaDto: GenerarAuditoriaDto,
  ): Promise<any> {

    const response = await this.auditoriaCrudService.traerDataCrud(
      'auditoria-padre',
      auditoriaPadreId,
      {},
    );

    if (!response.Data) {
        throw new BadRequestException(
          `Auditoría padre no encontrada`,
        );
      }
  
      return this.generarAuditoriasParaPadre(
        response.Data,
        generarAuditoriaDto,
        true,
      );
    }


  /**
   * Genera auditorías hijas para una auditoría padre específica
   */
  private async generarAuditoriasParaPadre(
    auditoriaPadre: any,
    generarAuditoriaDto: GenerarAuditoriaDto,
    soloUna = false,
  ): Promise<any> {
    const auditoriaPadreId = auditoriaPadre._id;

    if (!auditoriaPadre.cantidad_auditorias) {
      throw new BadRequestException(
        `La auditoría no tiene cantidad asignada`,
      );
    }

    // 1. Obtener hijas existentes
    const response = await this.auditoriaCrudService.traerDataCrud(
        'auditoria',
        null,
        {
          query: `auditoria_padre_id:${auditoriaPadreId},activo:true`,
          limit: 0,
        },
    );

    const auditoriasExistentes = response.Data || [];

    const cantidadExistente = auditoriasExistentes.length;
    const cantidadMaxima = auditoriaPadre.cantidad_auditorias;

    if (cantidadExistente >= cantidadMaxima) {
        throw new BadRequestException(
          'Ya tiene el número máximo de auditorías',
        );
    }

    const cantidadACrear = soloUna
      ? 1
      : cantidadMaxima - cantidadExistente;

    const nuevasAuditorias = [];

    for (let i = 0; i < cantidadACrear; i++) {
      const indexReal = cantidadExistente + i;

      const auditoria = await this.crearAuditoriaHija(
        auditoriaPadre,
        indexReal,
      );

      await this.crearEstadoAuditoria(
        auditoria.Data._id,
        generarAuditoriaDto,
      );

      nuevasAuditorias.push(auditoria.Data);
    }

    await this.actualizarEstadoPadre(
        auditoriaPadreId,
        generarAuditoriaDto,
      );
  
      return {
        auditoriaPadreId,
        auditoriasCreadas: nuevasAuditorias.length,
        auditorias: nuevasAuditorias,
      };
    }

  private async crearAuditoriaHija(
    auditoriaPadre: any,
    indexReal: number,
  ): Promise<any> {
    const esInforme =
      auditoriaPadre.tipo_evaluacion_id ===
      TIPO_EVALUACION.INFORME;

    const cronograma = auditoriaPadre.cronograma_id || [];

    let subtitulo: string | undefined;

    // Asignación directa del mes SI APLICA
    if (esInforme && cronograma[indexReal]) {
      subtitulo =
        this.MESES_MAP[Number(cronograma[indexReal])];
    }

    //  Creacion de la auditoria, solo agregar subtitulo si existe
    return this.auditoriaCrudService.post('auditoria', {
      plan_auditoria_id: auditoriaPadre.plan_auditoria_id,
      auditoria_padre_id: auditoriaPadre._id,
      vigencia_id: auditoriaPadre.vigencia_id,
      ...(subtitulo && { subtitulo }),
    });
  }

    /**
   * Actualiza el estado de una auditoría 
   */
  private async crearEstadoAuditoria(
    auditoriaId: string,
    dto: GenerarAuditoriaDto,
  ): Promise<void> {
    await this.auditoriaCrudService.post(
      'auditoria-estado',
      {
        auditoria_id: auditoriaId,
        usuario_id: dto.usuario_id,
        usuario_rol: dto.usuario_rol,
        observacion: dto.observacion,
        estado_id: dto.estado_id_hija_nuevo,
        fase_id: dto.fase_id,
      },
    );
  }


  /**
   * Actualiza el estado de una auditoría padre
   */
  private async actualizarEstadoPadre(
    auditoriaPadreId: string,
    dto: GenerarAuditoriaDto,
  ): Promise<void> {
    await this.auditoriaCrudService.post(
      'auditoria-padre-estado',
      {
        auditoria_padre_id: auditoriaPadreId,
        usuario_id: dto.usuario_id,
        usuario_rol: dto.usuario_rol,
        observacion: dto.observacion,
        estado_id: dto.estado_id_padre_nuevo,
        fase_id: dto.fase_id,
      },
    );
  }

}
