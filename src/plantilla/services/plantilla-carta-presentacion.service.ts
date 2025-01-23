import { Injectable } from '@nestjs/common';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../utils/plantilla.utils';

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
    const infoParaPlantilla = {
      plantilla_id: '6752188ddddf9a06db2a0b3c',
      data: {
        ciudad: 'Bogotá D.C.', //quemada
        auditoria: 'Auditoría Interna', //auditoria titulo
        dia: '5', //fecha inicio
        mes: 'diciembre',
        anio: '2024',
        objetivo: 'Revisión de procesos financieros', //auditoria objetivo
      },
    };

    return infoParaPlantilla;
  }
}
