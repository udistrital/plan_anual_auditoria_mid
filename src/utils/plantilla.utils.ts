import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment as env } from 'src/config/configuration';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class PlantillaUtilsService {
  constructor(private readonly httpService: HttpService) {}

  async renderizarPlantilla(data: any): Promise<any> {
    const urlPlanAuditoria = `${env().PLANTILLAS_MID_SERVICE}/v1/plantilla/renderizar`;
    try {
      const response = await lastValueFrom(
        this.httpService.post(urlPlanAuditoria, data),
      );
      return response.data;
    } catch (error) {
      console.error('Error al enviar data:', error);
      throw new Error('No se pudo enviar el plan');
    }
  }

  async obtenerAuditoria(idAuditoria: string) {
    let urlAuditoria = `${env().PLAN_AUDITORIA_CRUD_SERVICE}auditoria/${idAuditoria}`;
    try {
      const respuestaAuditoria = await lastValueFrom(
        this.httpService.get(urlAuditoria),
      );
      return {
        auditoria: respuestaAuditoria.data.Data,
      };
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
