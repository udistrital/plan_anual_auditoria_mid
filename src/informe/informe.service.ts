import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from 'src/config/configuration';

const { PLAN_AUDITORIA_CRUD_SERVICE } = environment;

@Injectable()
export class InformeService {
  private readonly logger = new Logger(InformeService.name);

  constructor(private readonly httpService: HttpService) {}

  async getInformeCompleto(id: string) {
    try {
      this.logger.log(`Consultando informe completo con ID: ${id}`);

      // Obtener informe base del CRUD
      const informeBase = await lastValueFrom(
        this.httpService.get(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${id}`).pipe(
          map(res => res.data.Data),
          catchError(() => {
            throw new HttpException(
              `Informe con ID ${id} no encontrado`,
              HttpStatus.NOT_FOUND
            );
          })
        )
      );

      // Orquestar llamadas paralelas para complementar datos
      const complementos$ = forkJoin({
        auditoria: this.httpService
          .get(`${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/${informeBase.auditoria_id}`)
          .pipe(
            map(res => res.data.Data),
            catchError((error) => {
              this.logger.warn(`No se pudo obtener auditoría: ${error.message}`);
              return of(null);
            })
          ),

        hallazgos: this.httpService
          .get(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${id}/hallazgos`)
          .pipe(
            map(res => res.data.Data),
            catchError((error) => {
              this.logger.warn(`No se pudieron obtener hallazgos: ${error.message}`);
              return of([]);
            })
          ),

        temas: this.httpService
          .get(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${id}/tema`)
          .pipe(
            map(res => res.data.Data),
            catchError((error) => {
              this.logger.warn(`No se pudieron obtener temas: ${error.message}`);
              return of([]);
            })
          ),

        estado_actual: this.httpService
          .get(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${id}/estado-actual`)
          .pipe(
            map(res => res.data.Data),
            catchError((error) => {
              this.logger.warn(`No se pudo obtener estado actual: ${error.message}`);
              return of(null);
            })
          ),

        historial_estados: this.httpService
          .get(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${id}/estados`)
          .pipe(
            map(res => res.data.Data),
            catchError((error) => {
              this.logger.warn(`No se pudo obtener historial de estados: ${error.message}`);
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

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error al obtener informe completo: ${error.message}`, error.stack);
      throw new HttpException(
        'Error al obtener el informe completo',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getAll(queryParams: any) {
    try {
      const queryString = new URLSearchParams(queryParams).toString();
      const url = `${PLAN_AUDITORIA_CRUD_SERVICE}informe?${queryString}`;

      const response = await lastValueFrom(
        this.httpService.get(url).pipe(
          map(res => res.data),
          catchError(() => {
            throw new HttpException(
              'Error al obtener informes',
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          })
        )
      );

      // Complementar cada informe con datos básicos de auditoría y estado
      if (response.Data && Array.isArray(response.Data)) {
        const informesConComplementos = await Promise.all(
          response.Data.map(async (informe: any) => {
            const complementos$ = forkJoin({
              auditoria: this.httpService
                .get(`${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/${informe.auditoria_id}`)
                .pipe(
                  map(res => res.data.Data),
                  catchError(() => of(null))
                ),

              estado_actual: this.httpService
                .get(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${informe._id}/estado-actual`)
                .pipe(
                  map(res => res.data.Data),
                  catchError(() => of(null))
                )
            });

            const extras = await lastValueFrom(complementos$);
            return { ...informe, ...extras };
          })
        );

        response.Data = informesConComplementos;
      }

      return response;

    } catch (error) {
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

    } catch (error) {
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

  async update(id: string, body: any) {
    try {
      this.logger.log(`Actualizando informe con ID: ${id}`);

      const response = await lastValueFrom(
        this.httpService.put(`${PLAN_AUDITORIA_CRUD_SERVICE}informe/${id}`, body).pipe(
          map(res => res.data),
          catchError((error) => {
            throw new HttpException(
              error.response?.data?.Message || 'Error al actualizar informe',
              error.response?.status || HttpStatus.BAD_REQUEST
            );
          })
        )
      );

      this.logger.log(`Informe ${id} actualizado exitosamente`);
      return response;

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error al actualizar informe: ${error.message}`, error.stack);
      throw new HttpException(
        'Error al actualizar informe',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

}