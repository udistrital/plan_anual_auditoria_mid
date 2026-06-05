import { Injectable } from "@nestjs/common";
import { AuditoriaService } from "src/application/auditoria/auditoria.service";
import { environment } from "src/config/configuration";
import { AuditoriaCrudService } from "src/shared/services/auditoria-crud.service";
import { PlantillasMidService } from "src/shared/services/plantillas-mid.service";

const {
    PLANTILLAS,
    logoUDistrital,
    logoSIGUD
} = environment;

@Injectable()
export class PlantillaPlanMejoramientoService {
    constructor(
        private readonly plantillasMidService: PlantillasMidService,
        private readonly auditoriaCrudService: AuditoriaCrudService,
        private readonly auditoriaService: AuditoriaService,
    ) {}

    async get(idAuditoria: string) {
        const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
        const infoParaPlantilla = await this.organizarData({
        auditoria: auditoriaRespuesta?.Data || {},
        });
        return await this.plantillasMidService.post(
        '/v1/plantilla/renderizar',
        infoParaPlantilla,
        );
  }

  private async organizarData(dataAuditoria: any) {
    try {
        const infoParaPlantilla = {
            plantilla_id: PLANTILLAS.PLAN_MEJORAMIENTO,
            data: {
                "proceso_responsable": "",
                "lider_proceso": "",
                "gestor_proceso": "",
                "fecha": "",
                "fuentes": {
                "auditoria_interna": "",
                "auditoria_externa": "",
                "producto_no_conforme": "",
                "quejas_reclamos": "",
                "revision_direccion": "",
                "indicadores_proceso": "",
                "evaluacion_desempeno": "",
                "mejoramiento_continuo": ""
                },
                "hallazgos": [
                {
                    "numero": "",
                    "descripcion": "",
                    "causa": "",
                    "tipo_accion": "",
                    "accion_planteada": "",
                    "nombre_indicador": "",
                    "formula_indicador": "",
                    "meta": "",
                    "responsables": "",
                    "fecha_inicio": "",
                    "fecha_fin": ""
                }
                ],
                "filas_vacias": 7
            }
        }
        return infoParaPlantilla;
    } catch (error: any) {
        const newError = new Error(
        'Error al organizar los datos para la plantilla del Informe de Auditoría',
      );
      newError.stack = error.stack;
      throw newError;
    }
  }
}