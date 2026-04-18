import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { PlantillaUtilsService } from 'src/utils/plantilla.utils';

const {
    PLAN_AUDITORIA_CRUD_SERVICE,
    PLANTILLAS,
    // PARAMETROS_SERVICE,
    TERCEROS_SERVICE,
    TIPO_EVALUACION,
    ESTADOS_INFORME_AUDITORIA_PRELIMINAR,
    ID_DEPENDENCIA_OCI,
    ID_CARGO_OCI
} = environment;

@Injectable()
export class PlantillaInformeAuditoriaService {
    constructor(
        private readonly httpService: HttpService,
        private readonly plantillaUtils: PlantillaUtilsService,
        private readonly auditoriaService: AuditoriaService,
    ) { }

    async get(idAuditoria: string) {
        const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
        const infoParaPlantilla = await this.organizarData({ auditoria: auditoriaRespuesta?.Data || {} });
        return await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);
    }

    private async organizarData(dataAuditoria: any) {
        try {
            const auditoria = dataAuditoria.auditoria;
            if (!auditoria?._id) {
                throw new Error('No se encontró la auditoría para generar la plantilla');
            }

            const informe = await this.obtenerInformeAuditoria(auditoria._id);
            if (!informe?._id) {
                throw new Error('No se encontró el informe asociado a la auditoría');
            }

            const temas = await this.obtenerTemasInforme(informe._id);
            const temasReestructurados = await this.reestructurarTemas(temas);
            const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
            const [tituloInforme, jefeOci, auditorResponsable] = await Promise.all([
                this.generarTituloInforme(auditoria._id, auditoria.tipo_evaluacion_id, auditoria.titulo),
                this.obtenerJefeOci(),
                this.obtenerAuditorResponsable(auditoria._id)
            ]);

            const infoParaPlantilla = {
                plantilla_id: PLANTILLAS.INFORME_AUDITORIA_INTERNA,
                data: {
                    consecutivo: auditoria.consecutivo_no_auditoria,
                    fecha_emision: {
                        dia: dia,
                        mes: mes,
                        anio: anio,
                    },
                    informe: {
                        titulo: tituloInforme,
                        dependencia: auditoria.proceso_nombre[0] + ' / ' + auditoria.dependencia_nombre[0], // TODO: Ajustar para diferentes dependencias y procesos
                        lider: auditoria.jefe_nombre,
                        responsable: auditoria.asistente_nombre,
                        objetivo: auditoria.objetivo,
                        alcance: auditoria.alcance,
                        criterios: auditoria.criterio,
                        muestra: informe.muestra,
                    },
                    aspectos_generales: this.normalizarTextoEditor(informe.aspecto_general),
                    temas: temasReestructurados,
                    informe_final: this.normalizarTextoEditor(informe.informe_final),
                    observaciones_conclusiones: this.normalizarTextoEditor(informe.observacion_conclusion),
                    notas: this.normalizarTextoEditor(informe.nota),
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

    private normalizarTextoEditor(valor: string | null | undefined): string {
        if (!valor) {
            return '';
        }

        return valor
            .replace(/&nbsp;/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>\s*<p>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+\n/g, '\n')
            .replace(/\n\s+/g, '\n')
            .trim();
    }

    private async obtenerInformeAuditoria(idAuditoria: string) {
        const urlInforme = `${PLAN_AUDITORIA_CRUD_SERVICE}informe?query=auditoria_id:${idAuditoria},activo:true&fields=_id,fecha_emision,muestra,aspecto_general,informe_final,observacion_conclusion,nota&limit=1`;
        try {
            const respuestaInforme = await lastValueFrom(this.httpService.get(urlInforme));
            return respuestaInforme.data.Data[0];
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    private async obtenerTemasInforme(idInforme: string) {
        const urlTemas = `${PLAN_AUDITORIA_CRUD_SERVICE}tema?query=informe_id:${idInforme},activo:true`;
        try {
            const respuestaTemas = await lastValueFrom(
                this.httpService.get(urlTemas),
            );
            return respuestaTemas.data.Data || [];
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async generarTituloInforme(idAuditoria: string, tipo_evaluacion_id: number, auditoriaTitulo: string) {
        const tipo =
            tipo_evaluacion_id === TIPO_EVALUACION.AUDITORIA_INTERNA
                ? "Auditoria Interna"
                : "Auditoria de Seguimiento";

        const estado_id = await this.consultarEstadoAuditoria(idAuditoria);

        const sufijo = ESTADOS_INFORME_AUDITORIA_PRELIMINAR.includes(estado_id)
            ? "Preliminar"
            : "Final";

        return `${tipo}: ${auditoriaTitulo} - ${sufijo}`;
    }

    private async consultarEstadoAuditoria(idAuditoria: string) {
        const urlEstadoAuditoria = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria-estado?query=auditoria_id:${idAuditoria},activo:true,actual:true&fields=estado_id&limit=1`;

        try {
            const respuestaEstado = await lastValueFrom(this.httpService.get(urlEstadoAuditoria));
            return respuestaEstado.data.Data[0].estado_id;
        } catch (error) {
            throw new HttpException(
                'Error al obtener el estado de la auditoria',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
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

    // private async traerParametros(idParam: string) {
    //     const url = `${PARAMETROS_SERVICE}/parametro?query=Id:${idParam}&fields=Nombre`;
    //     try {
    //         const response = await lastValueFrom(this.httpService.get(url));
    //         return response.data.Data[0];
    //     } catch (error) {
    //         throw new HttpException(
    //             'Error al obtener los datos del servicio externo',
    //             HttpStatus.INTERNAL_SERVER_ERROR,
    //         );
    //     }
    // }

    private async obtenerAuditorResponsable(auditorId: string): Promise<string> {
        const auditores = (await this.obtenerAuditores(auditorId)) || [];
        switch (auditores.length) {
            case 0:
                return 'Sin auditor asignado.';
            case 1:
                const tercero = await this.obtenerTercero(auditores[0].auditor_id);
                return tercero?.NombreCompleto || 'Sin auditor asignado.';
            default:
                const auditorLider = auditores.find(a => a.auditor_lider == true);
                if (auditorLider) {
                    const tercero = await this.obtenerTercero(auditorLider.auditor_id);
                    return tercero?.NombreCompleto || 'Sin auditor asignado.';
                } else {
                    const tercero = await this.obtenerTercero(auditores[0].auditor_id);
                    return tercero?.NombreCompleto || 'Sin auditor asignado.';
                }
        }
    }

    private async obtenerAuditores(auditoriaId: string) {
        const url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditor?query=auditoria_id:${auditoriaId},activo:true&limit=0`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data.Data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos de terceros',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async obtenerTercero(terceroId: string) {
        const url = `${TERCEROS_SERVICE}/tercero/${terceroId}`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos de terceros',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    private async obtenerJefeOci() {
        const url = `${TERCEROS_SERVICE}vinculacion?query=DependenciaId:${ID_DEPENDENCIA_OCI},CargoId:${ID_CARGO_OCI},Activo:true`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data?.[0]?.TerceroPrincipalId?.NombreCompleto || "No se encontró el jefe de la Oficina Asesora de Control Interno";
        } catch (error) {
            return "No se encontró el jefe de la Oficina Asesora de Control Interno";
        }
    }
}
