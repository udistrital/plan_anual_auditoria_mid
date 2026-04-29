import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { lastValueFrom, forkJoin, of, catchError, from } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';

@Injectable()
export class InformeService {
  private readonly logger = new Logger(InformeService.name);

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async getInformeCompleto(id: string) {
    try {
      this.logger.log(`Consultando informe completo con ID: ${id}`);

      // Obtener informe base del CRUD
      const informeBase = await this.auditoriaCrudService.traerDataCrud('informe', id, null).then(data => data.Data)
        .catch((error) => {
          this.logger.warn(`No se pudo obtener el informe: ${error.message}`);
          throw new HttpException(
            `Informe con ID ${id} no encontrado`,
            HttpStatus.NOT_FOUND
          );
        }); 

      // Orquestar llamadas paralelas para complementar datos
      const complementos$ = forkJoin({
        auditoria: from(this.auditoriaService.getOne(informeBase.auditoria_id).then(data => data.Data))
          .pipe(
            catchError((error) => {
              this.logger.warn(`No se pudo obtener auditoría: ${error.message}`);
              return of(null);
            })
          ),

        hallazgos: from(this.auditoriaCrudService.traerDataCrud(`informe/${id}/hallazgos`, null, null).then(data => data.Data))
          .pipe(
            catchError((error) => {
              this.logger.warn(`No se pudieron obtener hallazgos: ${error.message}`);
              return of([]);
            })
          ),

        temas: from(this.auditoriaCrudService.traerDataCrud('tema', null, { query: `informe_id:${id},activo:true`}).then(data => data.Data))
          .pipe(
            catchError((error) => {
              this.logger.warn(`No se pudieron obtener temas: ${error.message}`);
              return of([]);
            })
          )
      });

      const infoExtra = await lastValueFrom(complementos$);

      // Consolidar toda la información
      const informeCompleto = {
        ...informeBase,
        ...infoExtra
      };

      this.logger.log(`Informe ${id} consultado exitosamente con datos complementarios`);
      return informeCompleto;

    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error al obtener informe completo: ${error.message}`, error.stack);
      throw new HttpException(
        'Error al obtener el informe completo',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error
      );
    }
  }

  async getAll(queryParams: any) {
    try {
      const response = await this.auditoriaCrudService.traerDataCrud('informe', null, queryParams);

      // Complementar cada informe con datos básicos de auditoría y estado
      if (response.Data && Array.isArray(response.Data)) {
        const informesConComplementos = await Promise.all(
          response.Data.map(async (informe: any) => {
            const complementos$ = forkJoin({
              auditoria: from(this.auditoriaService.getOne(informe.auditoria_id).then(data => data.Data))
            });

            const extras = await lastValueFrom(complementos$);
            return { ...informe, ...extras };
          })
        );

        response.Data = informesConComplementos;
      }

      return response;

    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error al obtener todos los informes: ${error.message}`, error.stack);
      throw new HttpException(
        'Error al obtener informes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getByAuditoria(auditoriaId: string) {
    try {
      this.logger.log(`Consultando informes de auditoría ${auditoriaId}`);

      const queryParams = {
        query: `auditoria_id:${auditoriaId},activo:true`,
        sortby: 'fecha_creacion',
        order: 'desc',
        limit: '100'
      };

      return await this.getAll(queryParams);

    } catch (error: any) {
      this.logger.error(
        `Error al consultar informes por auditoría: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        'Error al consultar informes por auditoría',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

}