import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../../../utils/plantilla.utils';
import { environment } from 'src/config/configuration';

@Injectable()
export class PlantillaCartaPresentacionService {
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
    const fechaInicio = moment(auditoria.fecha_inicio);
    const infoParaPlantilla = {
      plantilla_id: environment.PLANTILLAS.CARTA_PRESENTACION,
      data: {
        ciudad: 'Bogotá D.C.',
        auditoria: auditoria.titulo,
        dia: fechaInicio.date(),
        mes: fechaInicio.format('MMMM'),
        anio: fechaInicio.year(),
        objetivo: auditoria.objetivo,
      },
    };
    return infoParaPlantilla;
  }
}
