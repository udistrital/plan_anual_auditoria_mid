import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { ParametrosService } from 'src/shared/services/parametros/parametros.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros/terceros-helper.service';

const {
    PLANTILLAS,
    TIPO_EVALUACION,
    ESTADOS_INFORME_AUDITORIA_PRELIMINAR,
    CARGO
} = environment;

@Injectable()
export class PlantillaInformeSeguimientoService {
    constructor(
        private readonly plantillasMidService: PlantillasMidService,
        private readonly auditoriaCrudService: AuditoriaCrudService,
        private readonly parametrosService: ParametrosService,
        private readonly auditoriaService: AuditoriaService,
        private readonly tercerosService: TercerosHelperService,
    ) {}

    async get(idAuditoria: string) {
        const auditoria = await this.auditoriaService.getOne(idAuditoria);
        const inforParaPlantilla = await this.organizarData(auditoria.Data);
        const baseRenderizado = await this.plantillasMidService.post('/v1/plantilla/renderizar', inforParaPlantilla);
        return baseRenderizado;
    }

    private async organizarData(auditoria: any) {
        try {
            const informe = await this.obtenerInformeSeguimiento(auditoria._id);
            const temas = await this.obtenerTemasInforme(informe._id);
            const temasReestructurados = await this.reestructurarTemas(temas);
            const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
            const [tituloInforme, macroproceso, lider, responsable, jefeOci, auditorResponsable] = await Promise.all([
                this.generarTituloInforme(auditoria._id, auditoria.tipo_evaluacion_id, auditoria.titulo),
                this.parametrosService.get('parametro', auditoria.macroproceso, null).then(data => data.Data),
                this.parametrosService.get('parametro', auditoria.lider_id, null).then(data => data.Data),
                this.parametrosService.get('parametro', auditoria.responsable_id, null).then(data => data.Data),
                this.tercerosService.getJefeOCI(),
                this.obtenerAuditorResponsable(auditoria._id)
            ]);

            const infoParaPlantilla = {
                plantilla_id: PLANTILLAS.INFORME_SEGUIMIENTO,
                data: {
                    consecutivo: auditoria.no_auditoria,
                    fecha_emision: {
                        dia: dia,
                        mes: mes,
                        anio: anio,
                    },
                    informe: {
                        titulo: tituloInforme,
                        dependencia: macroproceso.Nombre,
                        lider: lider.Nombre,
                        responsable: responsable.Nombre,
                        objetivo: auditoria.objetivo,
                        alcance: auditoria.alcance,
                        criterios: auditoria.criterio,
                        muestra: informe.muestra,
                    },
                    aspectos_generales: informe.aspectos_generales,
                    temas: temasReestructurados,
                    informe_final: informe.informe_final || "",
                    observaciones_conclusiones: informe.observaciones_conclusiones || "",
                    notas: informe.notas || "",
                    jefe_oci: jefeOci || "No se encontró el jefe de la Oficina Asesora de Control Interno",
                    auditor_responsable: auditorResponsable
                }
            }
            return infoParaPlantilla;
        } catch (error) {
            throw new HttpException(
                'Error al organizar los datos para la plantilla',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async obtenerInformeSeguimiento(idAuditoria: string) {
        const params = {
            query: `auditoria_id:${idAuditoria},activo:true`,
            limit: 1
        };
        const respuestaInforme = await this.auditoriaCrudService.traerDataCrud('informe', null, params);
        return respuestaInforme.Data[0];
    }


    private async obtenerTemasInforme(idInforme: string) {
        const params = {
            query: `informe_id:${idInforme},activo:true`,
            limit: 0
        };
        const respuestaTemas = await this.auditoriaCrudService.traerDataCrud('tema', null, params);
        return respuestaTemas.Data;
    }

    private async generarTituloInforme(idAuditoria: string, tipo_evaluacion_id: number, auditoriaTitulo: string) {
        let titulo = "";

        if (tipo_evaluacion_id == TIPO_EVALUACION.AUDITORIA_INTERNA) {
            titulo += "Auditoria Interna: ";
        } else {
            titulo += "Auditoria de Seguimiento: "
        }

        titulo += auditoriaTitulo;
        const params = {
            query: `auditoria_id:${idAuditoria},activo:true,actual:true`,
            limit: 1,
        }
        const estado_auditoria_id = await this.auditoriaCrudService.traerDataCrud('auditoria-estado', null, params).then(data => data.Data);

        if (estado_auditoria_id[0] in ESTADOS_INFORME_AUDITORIA_PRELIMINAR) {
            titulo += " - Preliminar";
        } else {
            titulo += " - Final";
        }
        return titulo;
    }

    private async reestructurarTemas(temas: any[]) {
        return temas.map(({ subtema, ...data }) => ({
        ...data,
            subtemas: subtema?.map(({ hallazgo, ...sub }) => ({
                ...sub,
                hallazgos: hallazgo ?? [],
            })) ?? [],
        }));
    }

    private async obtenerAuditorResponsable(auditoriaId: string): Promise<string> {
        const params = { query: `auditoria_id:${auditoriaId},activo:true`, limit: 0 }
        const auditores = await this.auditoriaCrudService.traerDataCrud('auditor', null, params).then(data => data.Data);
        switch (auditores.length) {
            case 0:
                return 'Sin auditor asignado.';
            case 1:
                const tercero = await this.tercerosService.getTerceroById(auditores[0].auditor_id);
                return tercero.NombreCompleto;
            default:
                const auditorLider = auditores.find(a => a.auditor_lider == true);
                if (auditorLider) {
                    const tercero = await this.tercerosService.getTerceroById(auditorLider.auditor_id);
                    return tercero.NombreCompleto;
                } else {
                    const tercero = await this.tercerosService.getTerceroById(auditores[0].auditor_id);
                    return tercero.NombreCompleto;
                }
        }
    }
}
