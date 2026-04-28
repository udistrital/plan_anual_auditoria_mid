import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid/plantillas-mid.service';
import { ParametrosService } from 'src/shared/services/parametros/parametros.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';


const {
    PLANTILLAS,
    TERCEROS_SERVICE,
    OIKOS_SERVICE,
    logoUDistrital,
    logoSIGUD
} = environment;

@Injectable()
export class PlantillaProgramaAuditoriaService {
    constructor(
        private readonly httpService: HttpService,
        private readonly auditoriaService: AuditoriaService,
        private readonly auditoriaCrudService: AuditoriaCrudService,
        private readonly plantillasMidService: PlantillasMidService,
        private readonly parametrosService: ParametrosService,
    ) {}

    async get(idAuditoria: string) {
        const auditoria = await this.auditoriaService.getOne(idAuditoria);
        const infoParaPlantilla = await this.organizarData(auditoria.Data);
        const baseRenderizado = 
            await this.plantillasMidService.post('/v1/plantilla/renderizar', infoParaPlantilla);
        return baseRenderizado;
    }

    private async organizarData(auditoria: any) {
        try {
            const auditoriaPadre = auditoria;
            const dependenciaPrincipal = this.obtenerDependenciaPrincipal(auditoriaPadre?.dependencia_id);

            const [actividades, macroproceso, proceso, dependencia, Lider, Responsable, grupoAuditor] = await Promise.all([
            this.auditoriaCrudService.traerDataCrud('actividad', null, { query: `auditoria_id:${auditoria._id},activo:true`, limit: 0}).then(data => data.Data),
            this.parametrosService.get('parametro', auditoriaPadre.macroproceso_id, null).then(data => data.Data),
            this.parametrosService.get('parametro', auditoriaPadre.proceso_id, null).then(data => data.Data),
            this.obtenerDependencia(dependenciaPrincipal),
            this.obtenerTerceroVinculado(environment.CARGO.JEFE_DEPENDENCIA_ID, dependenciaPrincipal),
            this.obtenerTerceroVinculado(environment.CARGO.ASISTENTE_DEPENDENCIA_ID, dependenciaPrincipal),
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

    private organizarActividades(actividades: any[], grupoAuditor: string) {
        return actividades.map((dataActividad) => ({
            actividad: dataActividad.titulo,
            auditor: grupoAuditor,
            fechaInicial: moment(dataActividad.fecha_inicio).format('DD/MM/YYYY'),
            fechaFinal: moment(dataActividad.fecha_fin).format('DD/MM/YYYY'),
            observacion: dataActividad.observacion || '',
            referencia: dataActividad.referencia || '',
            descripcion: dataActividad.descripcion || '',
            folio: dataActividad.folio || '',
            medio: dataActividad.medio_id || '',
            carpeta: dataActividad.carpeta || '',
        }))
    }

    private async obtenerNombresAuditores(auditoriaId: string): Promise<string> {
        const params = {
            query: `auditoria_id:${auditoriaId},activo:true`,
            fields: 'auditor_id',
            limit: '0'
        }
        const auditores = await this.auditoriaCrudService.traerDataCrud('auditor', null, params).then(data => data.Data);

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

    private async obtenerDependencia(idDependencia: number | null) {
        if (idDependencia == null) {
            return { Nombre: 'No definido' };
        }

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

    private async obtenerTerceroVinculado(idCargo: number, idDependencia: number | null) {
        if (idDependencia == null) {
            return null;
        }

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

    private obtenerDependenciaPrincipal(dependenciaId: number | number[]): number | null {
        if (Array.isArray(dependenciaId)) {
            return dependenciaId.length > 0 ? dependenciaId[0] : null;
        }

        return typeof dependenciaId === 'number' ? dependenciaId : null;
    }
}
