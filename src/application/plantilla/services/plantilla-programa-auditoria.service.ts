import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../../../utils/plantilla.utils';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';


const {
    PLAN_AUDITORIA_CRUD_SERVICE,
    PLANTILLAS,
    PARAMETROS_SERVICE,
    TERCEROS_SERVICE,
    OIKOS_SERVICE
} = environment;

@Injectable()
export class PlantillaProgramaAuditoriaService {
    constructor(
        private readonly httpService: HttpService,
        private readonly plantillaUtils: PlantillaUtilsService,
    ) {}

    async get(idAuditoria: string) {
        const auditoria = await this.plantillaUtils.obtenerAuditoria(idAuditoria);
        const infoParaPlantilla = await this.organizarData(auditoria);
        const baseRenderizado = await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);
        return baseRenderizado;
    }

    private async organizarData(data: any) {
        try {
            const auditoria = data.auditoria;
            const [actividades, macroproceso, proceso, dependencia, cargoLider, cargoResponsable, grupoAuditor] = await Promise.all([
            this.obtenerActividades(auditoria._id),
            this.traerParametros(auditoria.macroproceso_id),
            this.traerParametros(auditoria.proceso_id),
            this.obtenerDependencia(auditoria.dependencia_id),
            this.traerParametros(auditoria.lider_id),
            this.traerParametros(auditoria.responsable_id),
            this.obtenerNombresAuditores(auditoria._id)
        ]);

        const actividadesOrganizadas = this.organizarActividades(actividades, grupoAuditor);
        const infoParaPlantilla = {
            plantilla_id: PLANTILLAS.PROGRAMA_TRABAJO,
            data: {
                actividades: actividadesOrganizadas,
                recursosTecnologicos: auditoria.rec_tecnologico,
                recursosMateriales: auditoria.rec_fisico,
                macroproceso: macroproceso.Nombre,
                proceso: proceso.Nombre,
                dependencia: dependencia.Nombre,
                lider: cargoLider.Nombre,
                responsable: cargoResponsable.Nombre,
                objetivos: auditoria.objetivo,
                alcance: auditoria.alcance,
                criterios: auditoria.criterio,
                equipoAuditor: grupoAuditor,
                periodoEjecucion: moment(auditoria.fecha_inicio).format('DD/MM/YYYY') + " - " + moment(auditoria.fecha_fin).format('DD/MM/YYYY'),
            }
        };

        return infoParaPlantilla;
        } catch (error) {
            throw new HttpException(
                'Error al organizar los datos para la plantilla',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async obtenerActividades(idAuditoria: string) {
        let urlActividades = `${PLAN_AUDITORIA_CRUD_SERVICE}actividad?query=auditoria_id:${idAuditoria}&fields=titulo,fecha_inicio,fecha_fin,observacion,referencia,descripcion,folio,medio_id,carpeta&limit=0`;
        try {
            const responseActividades = await lastValueFrom(
                this.httpService.get(urlActividades),
            );
            return responseActividades.data.Data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                error,
            );
        }
    }

    private organizarActividades(actividades: any[], grupoAuditor: string) {
        return actividades.map((dataActividad) => ({
            actividad: dataActividad.titulo,
            auditor: grupoAuditor,
            fechaInicial: moment(dataActividad.fecha_inicio).format('YYYY-MM-DD'),
            fechaFinal: moment(dataActividad.fecha_fin).format('YYYY-MM-DD'),
            observacion: dataActividad.observacion || '',
            referencia: dataActividad.referencia || '',
            descripcion: dataActividad.descripcion || '',
            folio: dataActividad.folio || '',
            medio: dataActividad.medio_id || '',
            carpeta: dataActividad.carpeta || '',
        }))
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

    private async obtenerNombresAuditores(auditoriaId: string): Promise<string> {
        const auditores = await this.traerAuditores(auditoriaId);

        if (!auditores?.length) return 'No se encontraron auditores.';

        const nombres = await Promise.all(
            auditores.map(async (auditor) => {
                try {
                    const tercero = await this.traerTercero(auditor.auditor_id);
                    return tercero?.NombreCompleto
                        ? capitalize(tercero.NombreCompleto)
                        : null;
                } catch (error) {
                    console.error(
                        `Error al obtener tercero ${auditor.auditor_id}:`,
                        error,
                    );
                    return null;
                }
            }),
        );
        

        const todosValidos = nombres.every((nombre) => nombre !== null);

        if (!todosValidos) {
            return 'Error al obtener los nombres de los auditores';
        }

        return unirListaNombres(nombres);
    }

    private async traerAuditores(auditoriaId: string) {
        const url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditor?query=auditoria_id:${auditoriaId},activo:true&limit=0&fields=auditor_id`;
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

    private async traerTercero(terceroId: string) {
        const url = `${TERCEROS_SERVICE}tercero/${terceroId}`;
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

    private async obtenerDependencia(idDependencia: string) {
        const url = `${OIKOS_SERVICE}dependencia/${idDependencia}`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos de la dependencia',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
