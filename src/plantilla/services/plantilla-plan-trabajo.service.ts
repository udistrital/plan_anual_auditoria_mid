import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import * as moment from 'moment';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../utils/plantilla.utils';

@Injectable()
export class PlantillaPlanTrabajoService {
  constructor(
    private readonly httpService: HttpService,
    private readonly plantillaUtils: PlantillaUtilsService,
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.obtenerAuditoria(idAuditoria);
    const infoParaPlantilla = await this.organizarData(auditoria);
    const baseRenderizado =
      await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);
    return baseRenderizado;
  }

  private async obtenerAuditoria(idAuditoria: string) {
    const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
    let urlAuditoria = `${apiUrl}auditoria/${idAuditoria}`;
    let urlActividades = `${apiUrl}actividad?query=auditoria_id:${idAuditoria},activo:true&limit=0`;
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
    const [macroproceso, lider, responsable] = await Promise.all([
      this.traerParametros(auditoria.macroproceso),
      this.traerParametros(auditoria.lider_id),
      this.traerParametros(auditoria.responsable_id),
    ]);
    const actividades = this.organizarActividades(data.actividadesAuditoria);
    const infoParaPlantilla = {
      plantilla_id: environment.PLANTILLAS.PROGRAMA_TRABAJO,
      data: {
        recursosTecnologicos: auditoria.rec_tecnologico,
        recursosHumanos: auditoria.rec_humano,
        recursosMateriales: auditoria.rec_fisico,
        macroproceso: macroproceso.Nombre,
        lider: lider.Nombre,
        responsable: responsable.Nombre,
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

  private async traerParametros(idParam: string) {
    const apiUrl = `${environment.PARAMETROS_SERVICE}`;
    const url = `${apiUrl}/parametro?query=Id:${idParam}&fields=Nombre`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data[0];
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
