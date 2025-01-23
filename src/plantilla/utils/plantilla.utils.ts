import { HttpException, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class PlantillaUtilsService {
  private readonly apiUrl = `${environment.PLANTILLAS_MID_SERVICE}/v1/plantilla`;

  constructor(private readonly httpService: HttpService) {}

  async renderizarPlantilla(data: any): Promise<any> {
    const urlPlanAuditoria = `${this.apiUrl}/renderizar`;
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
    const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
    let urlAuditoria = `${apiUrl}auditoria/${idAuditoria}`;
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
        error,
      );
    }
  }
}
