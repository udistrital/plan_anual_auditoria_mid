import { Inject, Injectable } from "@nestjs/common";
import { AuditoriaService } from "src/application/auditoria/auditoria.service";
import { environment } from "src/config/configuration";
import { AuditoriaCrudService } from "src/shared/services/auditoria-crud.service";
import { OikosService } from "src/shared/services/oikos.service";
import { ParametrosService } from "src/shared/services/parametros.service";
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
        private readonly parametrosService: ParametrosService,
        private readonly oikosService: OikosService,
        @Inject('MOMENT') private readonly moment: any,
    ) {}

    async get(idAuditoria: string) {
        const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
        const infoParaPlantilla = await this.organizarData({auditoria: auditoriaRespuesta?.Data || {}});
        return await this.plantillasMidService.post(
        '/v1/plantilla/renderizar',
        infoParaPlantilla,
        );
  }

  private async organizarData(auditoria: any) {
    try {
        const dataAuditoria = auditoria.auditoria;
        const [
            proceso_responsable,
            fuenteSeleccionada,
            dataHallazgos
        ] = await Promise.all([
            Promise.all(
                dataAuditoria.proceso_id.map((proceso_id: number) =>
                    this.parametrosService
                    .get('parametro', proceso_id, null)
                    .then((data) => data.Data),
                ),
            ),
            this.marcarFuente(dataAuditoria._id),
            this.obtenerHallazgos(dataAuditoria._id)
        ]);

        const infoParaPlantilla = {
            plantilla_id: PLANTILLAS.PLAN_MEJORAMIENTO,
            data: {
                "logoUDistrital": logoUDistrital,
                "logoSIGUD": logoSIGUD,
                "proceso_responsable": proceso_responsable.filter((p: any) => p).map((p: any) => p.Nombre).join(', '),
                "lider_proceso": dataAuditoria.datos_dependencias?.map(d => d.jefe_nombre).join(', ') || '',
                "gestor_proceso": dataAuditoria.datos_dependencias?.map(d => d.dependencia_nombre).join(', ') || '',
                "fecha": this.moment(dataAuditoria?.fecha_inicio).format('DD/MM/YY') || '',
                "fuentes": fuenteSeleccionada,
                "hallazgos": dataHallazgos
            }
        }
        return infoParaPlantilla;
    } catch (error: any) {
        const newError = new Error(
        'Error al organizar los datos para la plantilla de Plan de mejoramiento',
      );
      newError.stack = error.stack;
      throw newError;
    }
  }

  private async marcarFuente(auditoriaId: string):Promise<any> {
    const orden = [
        "auditoria_interna",
        "auditoria_externa",
        "producto_no_conforme",
        "quejas_reclamos",
        "revision_direccion",
        "indicadores_proceso",
        "evaluacion_desempeno",
        "mejoramiento_continuo"
    ];

    const planMejoramiento = await this.auditoriaCrudService.traerDataCrud('plan-mejoramiento', null, {
        query: `auditoria_id:${auditoriaId},activo:true`,
        limit: 0
    }).then((data) => data.Data);

    const fuenteSeleccionada = { [orden[planMejoramiento[0].fuente]]: "true" };
    return fuenteSeleccionada;
  }

  private async obtenerHallazgos(auditoriaId: string): Promise<any> {
    let contador = 0;
    let dataHallazgos = [];
    const tipo_accion = [
        "Preventiva",
        "Correctiva"
    ];

    const planMejoramiento = await this.auditoriaCrudService.traerDataCrud('plan-mejoramiento', null, {
        query: `auditoria_id:${auditoriaId},activo:true`,
        limit: 0
    }).then((data) => data.Data);

    const hallazgos = await this.auditoriaCrudService.traerDataCrud(`hallazgo`, null, { 
        query: `auditoria_id:${auditoriaId},activo:true`
    }).then((data) => data.Data);

    for(const hallazgo of hallazgos) {
        contador++;
        const accionesMejora = await this.auditoriaCrudService.traerDataCrud('accion-mejora', null, {
            query: `plan_mejoramiento_id:${planMejoramiento[0]._id},hallazgo_id:${hallazgo._id},activo:true`,
            limit: 0
        }).then((data) => data.Data);
        for(const accion of accionesMejora) {
            const responsablesAccion = await this.auditoriaCrudService.traerDataCrud('responsable-accion', null, {
                query: `accion_mejora_id:${accion._id},activo:true`
            }).then((data) => data.Data);
            const dependencias = await this.obtenerDependenciasResponsables(responsablesAccion);

            const data = {
                "numero": contador,
                "descripcion": hallazgo.descripcion,
                "causa": hallazgo.criterio,
                "tipo_accion": tipo_accion[accion.tipo_id - 1],
                "accion_planteada": accion.descripcion,
                "nombre_indicador": accion.nombre_indicador,
                "formula_indicador": accion.formula_indicador,
                "meta": accion.meta,
                "responsables": dependencias?.map(d => d.Nombre).join(', ') || '',
                "fecha_inicio": this.moment(accion?.fecha_inicio).format('DD/MM/YYYY') || '',
                "fecha_fin": this.moment(accion?.fecha_fin).format('DD/MM/YYYY') || ''
            };
            dataHallazgos.push(data);
        }
    }
    return dataHallazgos;
  }
  private async obtenerDependenciasResponsables(dependenciasResponsables: any): Promise<any> {
    let dependencias = [];

    for(const responsable of dependenciasResponsables ) {
        const dependencia = await this.oikosService.traerData('dependencia', responsable.dependencia_id, null);
        dependencias.push(dependencia);
    }
    return dependencias;
  }
}