import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { PlantillaUtilsService } from 'src/utils/plantilla.utils';

const {
    PLAN_AUDITORIA_CRUD_SERVICE,
    PLANTILLAS,
    PARAMETROS_SERVICE,
    TERCEROS_SERVICE,
    TIPO_EVALUACION,
    ESTADOS_INFORME_AUDITORIA_PRELIMINAR,
    CORE_AMAZON_CRUD_SERVICE,
    ID_DEPENDENCIA_OCI
} = environment;

@Injectable()
export class PlantillaInformeSeguimientoService {
    constructor(
        private readonly httpService: HttpService,
        private readonly plantillaUtils: PlantillaUtilsService,
    ) {}

    async get(idAuditoria: string) {
        const auditoria = await this.plantillaUtils.obtenerAuditoria(idAuditoria);
        const inforParaPlantilla = await this.organizarData(auditoria);
    }

    private async organizarData(dataAuditoria: any) {
        try {
            const auditoria = dataAuditoria.auditoria;
            const informe = await this.obtenerInformeSeguimiento(auditoria._id);
            const temas = await this.obtenerTemasInforme(informe._id);
            const temasReestructurados = await this.reestructurarTemas(temas);
            const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
            const [tituloInforme, macroproceso, lider, responsable, jefeOci, auditorResponsable] = await Promise.all([
                this.generarTituloInforme(auditoria._id, auditoria.tipo_evaluacion_id, auditoria.titulo),
                this.traerParametros(auditoria.macroproceso),
                this.traerParametros(auditoria.lider_id),
                this.traerParametros(auditoria.responsable_id),
                this.obtenerJefeOci(),
                this.obtenerAuditorResponsable(auditoria._id)
            ]);

            const infoParaPlantilla = {
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
            
        } catch (error) {
            throw new HttpException(
                'Error al organizar los datos para la plantilla',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async obtenerInformeSeguimiento(idAuditoria: string) {
        const urlInforme = `${PLAN_AUDITORIA_CRUD_SERVICE}informe?query=auditoria_id:${idAuditoria},activo:true&fields=_id,fecha_emision,muestra,aspectos_generales,informe_final,observaciones_conclusiones,notas&limit=1`;
        try {
            const respuestaInforme = await lastValueFrom(
                this.httpService.get(urlInforme),
            );

            return respuestaInforme.data.Data[0];
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                error,
            );
        }
    }


    private async obtenerTemasInforme(idInforme: string) {
        const urlTemas = `${PLAN_AUDITORIA_CRUD_SERVICE}informe/${idInforme}/tema`;
        try {
            const respuestaTemas = await lastValueFrom(
                this.httpService.get(urlTemas),
            );
            
            return respuestaTemas.data.Data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                error,
            );
        }
    }

    private async generarTituloInforme(idAuditoria: string, tipo_evaluacion_id: number, auditoriaTitulo: string) {
        let titulo = "";

        if (tipo_evaluacion_id == TIPO_EVALUACION.AUDITORIA_INTERNA) {
            titulo += "Auditoria Interna: ";
        } else {
            titulo += "Auditoria de Seguimiento: "
        }

        titulo += auditoriaTitulo;
        const estado_auditoria_id = await this.consultarEstadoAuditoria(idAuditoria);

        if (estado_auditoria_id in ESTADOS_INFORME_AUDITORIA_PRELIMINAR) {
            titulo += " - Preliminar";
        } else {
            titulo += " - Final";
        }
        return titulo;
    }

    private async consultarEstadoAuditoria(idAuditoria: string) {
        const urlEstadoAuditoria = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria-estado?query=auditoria_id:${idAuditoria},activo:true,actual:true&fields=estado_interno_id&limit=1`;

        try {
            const respuestaEstado = await lastValueFrom(
                this.httpService.get(urlEstadoAuditoria),
            );
            return respuestaEstado.data.Data[0];
        } catch (error) {
            throw new HttpException(
                'Error al obtener el estado de la auditoria',
                error,
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

    private async traerParametros(idParam: string) {
        const url = `${PARAMETROS_SERVICE}/parametro?query=Id:${idParam}&fields=Nombre`;
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

    private async obtenerAuditorResponsable(auditorId: string): Promise<string> {
        const auditores = await this.obtenerAuditores(auditorId);
        switch (auditores.length) {
            case 0:
                return 'Sin auditor asignado.';
            case 1:
                const tercero = await this.obtenerTercero(auditores[0].auditor_id);
                return tercero.NombreCompleto;
            default:
                const auditorLider = auditores.find(a => a.auditor_lider == true);
                if (auditorLider) {
                    const tercero = await this.obtenerTercero(auditorLider.auditor_id);
                    return tercero.NombreCompleto;
                } else {
                    const tercero = await this.obtenerTercero(auditores[0].auditor_id);
                    return tercero.NombreCompleto;
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

    private async obtenerTerceroPorNumeroIdentificacion(numero: string) {
        const url = `${TERCEROS_SERVICE}datos_identificacion?query=Numero:${numero}`;
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
        const url = `${CORE_AMAZON_CRUD_SERVICE}jefe_dependencia/?query=DependenciaId:${ID_DEPENDENCIA_OCI}&limit=-1&query=FechaInicio__lte%3A2026-02-04%2CFechaFin__gte%3A2026-02-04&order=desc&sortby=FechaFin`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            const jefe = await this.obtenerTerceroPorNumeroIdentificacion(response.data[0].TerceroId);
            return jefe.NombreCompleto;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos de terceros',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
