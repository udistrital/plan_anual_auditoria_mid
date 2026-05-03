import { Inject, Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { ParametrosService } from 'src/shared/services/parametros.service';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';

const { PLANTILLAS } = environment;

@Injectable()
export class PlantillaPlanTrabajoService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly parametrosService: ParametrosService,
    private readonly auditoriaService: AuditoriaService,
    @Inject('MOMENT') private readonly moment: any,
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.auditoriaService.getOne(idAuditoria);
    const params = {
      query: `auditoria_id:${idAuditoria},activo:true`,
      limit: 0,
    };
    const actividades = await this.auditoriaCrudService.traerDataCrud(
      'actividad',
      null,
      params,
    );
    const infoParaPlantilla = await this.organizarData({
      auditoria: auditoria.Data,
      actividadesAuditoria: actividades.Data,
    });
    const baseRenderizado = await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      infoParaPlantilla,
    );
    return baseRenderizado;
  }

  private async organizarData(data: any) {
    const auditoria = data.auditoria;
    const [macroproceso, lider, responsable] = await Promise.all([
      this.parametrosService
        .get('parametro', auditoria.macroproceso_id, null)
        .then((data) => data.Data),
      this.parametrosService
        .get('parametro', auditoria.lider_id, null)
        .then((data) => data.Data),
      this.parametrosService
        .get('parametro', auditoria.responsable_id, null)
        .then((data) => data.Data),
    ]);
    const actividades = this.organizarActividades(data.actividadesAuditoria);
    const infoParaPlantilla = {
      plantilla_id: PLANTILLAS.PROGRAMA_TRABAJO,
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
        fechaEjecucion: this.moment(auditoria.fecha_inicio).format('LL'),
        actividades: actividades,
      },
    };

    return infoParaPlantilla;
  }

  organizarActividades(actividades: any[]) {
    return actividades.map((actividad) => ({
      actividad: actividad.titulo,
      auditor: 'sdjk', // todo: esta quemado
      fechaInicial: this.moment(actividad.fecha_inicio).format('DD/MM/YYYY'),
      fechaFinal: this.moment(actividad.fecha_fin).format('DD/MM/YYYY'),
    }));
  }
}
