import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import * as moment from 'moment';
import 'moment/locale/es';

@Injectable()
export class PlantillaPlanTrabajoService {
  constructor(private readonly httpService: HttpService) {}

  async get(idAuditoria: string) {
    const data = await this.obtenerAuditoria(idAuditoria);
    const infoParaPlantilla = await this.organizarData(data);
    const baseRenderizado = await this.renderizar(infoParaPlantilla);
    return baseRenderizado;
  }

  private async obtenerAuditoria(idAuditoria: string) {
    const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
    let urlAuditoria = `${apiUrl}auditoria/${idAuditoria}`;
    let urlActividades = `${apiUrl}actividad?query=auditoria_id:673ce5d37cf5a06432446c5a,activo:true&limit=0`;
    try {
      const respuestaAuditoria = await lastValueFrom(
        this.httpService.get(urlAuditoria),
      );

      const respuestaActividades = await lastValueFrom(
        this.httpService.get(urlActividades),
      );

      return {
        auditoria: respuestaAuditoria.data.Data,
        actividadesAuditoria: respuestaActividades.data.Data,
      };
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo ',
        error,
      );
    }
  }

  private async organizarData(data: any) {
    const auditoria = data.auditoria;
    const actividades = this.organizarActividades(data.actividadesAuditoria);
    const infoParaPlantilla = {
      plantilla_id: '675214b4e11c6cfdd818c336',
      data: {
        recursosTecnologicos: auditoria.rec_tecnologico,
        recursosHumanos: auditoria.rec_humano,
        recursosMateriales: auditoria.rec_fisico,
        macroproceso: auditoria.macroproceso,
        lider: auditoria.lider_id,
        responsable: auditoria.responsable_id,
        objetivos: auditoria.objetivo,
        alcance: auditoria.alcance,
        criterios: auditoria.criterio,
        grupoAuditor: auditoria.rec_humano,
        fechaEjecucion: moment(auditoria.fecha_inicio)
          .locale('es')
          .format('LL'),
        actividades: actividades,
      },
    };

    return infoParaPlantilla;
  }

  organizarActividades(actividades: any[]) {
    return actividades.map((actividad) => ({
      actividad: actividad.titulo,
      auditor: 'sdjk', // todo: esta quemado
      fechaInicial: moment(actividad.fecha_inicio).format('DD/MM/YYYY'),
      fechaFinal: moment(actividad.fecha_fin).format('DD/MM/YYYY'),
    }));
  }

  private async renderizar(data: any) {
    const apiUrl = `${environment.PLANTILLAS_MID_SERVICE}`;
    let urlPlanAuditoria = `${apiUrl}v1/plantilla/renderizar`;
    try {
      const response = await lastValueFrom(
        this.httpService.post(urlPlanAuditoria, data),
      );
      return response.data;
    } catch (error) {
      throw new Error('No se pudo enviar el plan');
    }
  }
}
