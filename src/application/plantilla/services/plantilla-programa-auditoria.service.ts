import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../../../utils/plantilla.utils';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';


const {
    PLAN_AUDITORIA_CRUD_SERVICE,
    PLANTILLAS,
    PARAMETROS_SERVICE,
    TERCEROS_SERVICE,
    OIKOS_SERVICE,
    logoUDistrital,
    logoSIGUD
} = environment;

@Injectable()
export class PlantillaProgramaAuditoriaService {
    constructor(
        private readonly httpService: HttpService,
        private readonly plantillaUtils: PlantillaUtilsService,
        private readonly auditoriaService: AuditoriaService
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
            const auditoriaPadreRespuesta = await this.auditoriaService.getAll({query: `_id:${auditoria.auditoria_padre_id}`});
            const auditoriaPadre = auditoriaPadreRespuesta.Data[0];

            const [actividades, macroproceso, proceso, dependencia, Lider, Responsable, grupoAuditor] = await Promise.all([
            this.obtenerActividades(auditoria._id),
            this.traerParametros(auditoriaPadre.macroproceso_id),
            this.traerParametros(auditoriaPadre.proceso_id),
            this.obtenerDependencia(auditoriaPadre.dependencia_id),
            this.obtenerTerceroVinculado(environment.CARGO.JEFE_DEPENDENCIA_ID, auditoriaPadre.dependencia_id),
            this.obtenerTerceroVinculado(environment.CARGO.ASISTENTE_DEPENDENCIA_ID, auditoriaPadre.dependencia_id),
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
                lider: Lider?.NombreCompleto || '',
                responsable: Responsable?.NombreCompleto || '',
                objetivos: auditoria.objetivo,
                alcance: auditoria.alcance,
                criterios: auditoria.criterio,
                equipoAuditor: grupoAuditor,
                periodoEjecucion: moment(auditoria.fecha_inicio).format('DD/MM/YYYY') + " - " + moment(auditoria.fecha_fin).format('DD/MM/YYYY'),
                logoUDistrital: logoUDistrital,
                logoSIGUD: logoSIGUD
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
        let urlActividades = `${PLAN_AUDITORIA_CRUD_SERVICE}actividad?query=auditoria_id:${idAuditoria},activo:true&fields=titulo,fecha_inicio,fecha_fin,observacion,referencia,descripcion,folio,medio_id,carpeta&limit=0`;
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

    private async obtenerTerceroVinculado(idCargo: number, idDependencia: number) {
        try {
            const datosPersona = await this.auditoriaService.traerTerceroVinculado(idDependencia, idCargo);
            return datosPersona;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del tercero vinculado',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
