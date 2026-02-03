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
    ESTADOS_INFORME_AUDITORIA_PRELIMINAR
} = environment;

@Injectable()
export class PlantillaInformeAuditoriaService {
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
            const informe = await this.obtenerInformeAuditoria(auditoria._id);
            const temas = await this.obtenerTemasInforme(informe._id);
            const temasReestructurados = await this.reestructurarTemas(temas);
            const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
            const [tituloInforme, lider, responsable] = await Promise.all([
                this.generarTituloInforme(auditoria._id, auditoria.tipo_evaluacion_id),
                this.traerParametros(auditoria.lider_id),
                this.traerParametros(auditoria.responsable_id),
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
                    dependencia: auditoria.macroproceso,
                    lider: lider.Nombre,
                    responsable: responsable.Nombre,
                    objetivo: auditoria.objetivo,
                    alcance: auditoria.alcance,
                    criterios: auditoria.criterio,
                    muestra: informe.muestra,
                },
                aspectos_generales: informe.aspectos_generales,
                temas: temasReestructurados,
                informe_final: informe.informe_final || null,
                observaciones_conclusiones: informe.observaciones_conclusiones || null,
                notas: informe.notas || null,
                
            }
            
            
        } catch (error) {
            throw new HttpException(
                'Error al organizar los datos para la plantilla',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async obtenerInformeAuditoria(idAuditoria: string) {
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

    private async generarTituloInforme(idAuditoria: string, tipo_evaluacion_id: number) {
        let titulo = "";

        if (tipo_evaluacion_id == TIPO_EVALUACION.AUDITORIA_INTERNA) {
            titulo += "Auditoria";
        } else {
            titulo += "Auditoria de Seguimiento"
        }

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
}
