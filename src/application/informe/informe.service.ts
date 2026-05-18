import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { lastValueFrom, forkJoin, of, catchError, from } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';

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
}
