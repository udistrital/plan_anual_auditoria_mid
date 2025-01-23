import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../utils/plantilla.utils';

@Injectable()
export class PlantillaSolicitudInformacionService {
  constructor(private readonly plantillaUtils: PlantillaUtilsService) {}

  async get(idAuditoria: string) {
    const auditoria = await this.plantillaUtils.obtenerAuditoria(idAuditoria);
    const infoParaPlantilla = await this.organizarData(auditoria);
    const baseRenderizado =
      await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);
    return baseRenderizado;
  }

  private async organizarData(data: any) {
    const auditoria = data.auditoria;
    const infoParaPlantilla = {
      plantilla_id: '67521530e11c6cfdd818c338',
      data: {
        fecha: '2024-12-05', //hoy
        ie: '12345', //consecutivo_ie
        nombreIngeniero: 'Juan Salmón', // cargo lider
        ciudad: 'Bogotá D.C.', //quemada
        referencia: 'Auditoría de Control Interno 2024', //titulo
        anoAuditoria: '2024', //vigencia_id
        auditoriaOSeguimiento: 'auditoría interna', // tipo_evaluacion_id
        auditores: 'María Pérez y Carlos López', // auditoria_auditor
        temas: [
          'Políticas de control interno',
          'Cumplimiento normativo',
          'Análisis de riesgos',
        ], //quemado
        imgFirmaTabla: 'https://example.com/signature-image.png',
        /////////////////
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
      },
    };

    return infoParaPlantilla;
  }
}
