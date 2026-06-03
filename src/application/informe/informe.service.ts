import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { lastValueFrom, forkJoin, of, catchError, from } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { numerarHallazgos } from 'src/shared/utils/numeracion-hallazgos.util';

@Injectable()
export class InformeService {

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async getInformeCompleto(id: string) {
    if (!id) {
      throw new BadRequestException('El id es requerido');
    }    
    // Obtener informe base del CRUD
    const informeBase = await this.auditoriaCrudService
      .traerDataCrud('informe', id, null)
      .then((data) => data.Data);

    if (!informeBase) {
      throw new NotFoundException(
        `Informe con con id ${id} no encontrado`,
      );
    }

    // Orquestar llamadas paralelas para complementar datos
    const complementos$ = forkJoin({
      auditoria: from(
        this.auditoriaService
          .getOne(informeBase.auditoria_id)
          .then((data) => data.Data),
      ).pipe(
        catchError(() => {
          return of(null);
        }),
      ),

      hallazgos: from(
        this.auditoriaCrudService
          .traerDataCrud(`informe/${id}/hallazgos`, null, null)
          .then((data) => data.Data),
      ).pipe(
        catchError(() => {
          return of([]);
        }),
      ),

      temas: from(
        this.auditoriaCrudService
          .traerDataCrud('tema', null, {
            query: `informe_id:${id},activo:true`,
          })
          .then((data) => data.Data),
      ).pipe(
        catchError(() => {
          return of([]);
        }),
      ),
    });

    const infoExtra = await lastValueFrom(complementos$);

    // Consolidar toda la información
    const informeCompleto = {
      ...informeBase,
      ...infoExtra,
    };

    return informeCompleto;
  }

  async getAll(queryParams: any) {
    const response = await this.auditoriaCrudService.traerDataCrud(
      'informe',
      null,
      queryParams,
    );

    // Complementar cada informe con datos básicos de auditoría y estado
    if (response.Data && Array.isArray(response.Data)) {
      const informesConComplementos = await Promise.all(
        response.Data.map(async (informe: any) => {
          const complementos$ = forkJoin({
            auditoria: from(
              this.auditoriaService
                .getOne(informe.auditoria_id)
                .then((data) => data.Data),
            ),
          });

          const extras = await lastValueFrom(complementos$);
          return { ...informe, ...extras };
        }),
      );

      response.Data = informesConComplementos;
    }

    return response;
  }

  async getByAuditoria(auditoriaId: string) {
    if (!auditoriaId) {
      throw new BadRequestException('El id es requerido');
    }

    const queryParams = {
      query: `auditoria_id:${auditoriaId},activo:true`,
      sortby: 'fecha_creacion',
      order: 'desc',
      limit: '100',
    };

    return await this.getAll(queryParams);
  }

  /**
   * Sella la numeración jerárquica (`no_hallazgo`) de todos los hallazgos
   * activos del informe de una auditoría. Se invoca al aprobar el informe
   * final. Idempotente: recalcula y sobreescribe en cada ejecución.
   */
  async sellarHallazgos(auditoriaId: string) {
    if (!auditoriaId) {
      throw new BadRequestException('El auditoriaId es requerido');
    }

    // 1. Informe activo de la auditoría
    const informeRes = await this.auditoriaCrudService.traerDataCrud(
      'informe',
      null,
      { query: `auditoria_id:${auditoriaId},activo:true`, limit: '1' },
    );
    const informeId = informeRes?.Data?.[0]?._id;
    if (!informeId) {
      throw new NotFoundException(
        `No se encontró informe activo para la auditoría ${auditoriaId}`,
      );
    }

    // 2. Temas (con subtemas embebidos) + hallazgos activos, en paralelo
    const [temasRes, hallazgosRes] = await Promise.all([
      this.auditoriaCrudService.traerDataCrud('tema', null, {
        query: `informe_id:${informeId},activo:true`,
        limit: '0',
      }),
      this.auditoriaCrudService.traerDataCrud('hallazgo', null, {
        query: `informe_id:${informeId},activo:true`,
        limit: '0',
      }),
    ]);

    // 3. Calcular numeración jerárquica
    const numerados = numerarHallazgos(
      temasRes?.Data ?? [],
      hallazgosRes?.Data ?? [],
    );
    if (numerados.length === 0) {
      return {
        Success: true,
        Status: 200,
        Message: 'No hay hallazgos activos para sellar.',
        Data: { informe_id: informeId, total: 0, sellados: 0, fallidos: [] },
      };
    }

    // 4. Persistir en lotes (limita la concurrencia contra el CRUD)
    const TAMANO_LOTE = 25;
    const fallidos: string[] = [];
    let sellados = 0;

    for (let i = 0; i < numerados.length; i += TAMANO_LOTE) {
      const tanda = numerados.slice(i, i + TAMANO_LOTE);
      const resultados = await Promise.all(
        tanda.map(async (n) => {
          try {
            await this.auditoriaCrudService.put('hallazgo', n.hallazgoId, {
              no_hallazgo: n.numero,
            });
            return true;
          } catch {
            fallidos.push(n.hallazgoId);
            return false;
          }
        }),
      );
      sellados += resultados.filter(Boolean).length;
    }

    return {
      Success: fallidos.length === 0,
      Status: 200,
      Message: 'Sellado de hallazgos completado.',
      Data: {
        informe_id: informeId,
        total: numerados.length,
        sellados,
        fallidos,
      },
    };
  }
}
