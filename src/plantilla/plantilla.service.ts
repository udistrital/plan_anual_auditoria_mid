import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { jsonPlantillaDto, PlantillaDto } from './dto/plantilla.dto'
@Injectable()


export class PlantillaService {
    constructor(
        private readonly httpService: HttpService,
    ) { }
    async getOne(id: string) {
        const data = await this.traerDataCrud(id);
        const baseJson = await this.organizarData(data);
        const baseRenderizado = await this.renderizar(baseJson)
        return baseRenderizado;
    }

    private async traerDataCrud(id: string) {
        const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
        let urlPlanAuditoria = `${apiUrl}plan-auditoria/${id}`;
        let urlAuditioria = `${apiUrl}auditoria?query=plan_auditoria_id:${id}&fields=titulo,cronograma_id`;
        try {
            const responsePlanAuditoria = await lastValueFrom(this.httpService.get(urlPlanAuditoria));
            let dataPlanAuditoria = responsePlanAuditoria.data
            const responseAuditoria = await lastValueFrom(this.httpService.get(urlAuditioria));
            let dataAuditoria = responseAuditoria.data

            return { dataPlanAuditoria, dataAuditoria }
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ', error,

            );

        }
    }

    private async organizarData(data: any) {
        const json = new jsonPlantillaDto();

        const auditorias = data.dataAuditoria?.Data || [];

        const items: PlantillaDto[] = Array.isArray(auditorias)
            ? auditorias.map((auditoria: any) => this.organizarItems(auditoria))
            : [];

        json.plantilla_id = '670f39835d9c11db9d50ea67';
        json.data = {
            codigo: "EC-PR-005-FR-001",
            proceso: 'Gestión de la Evaluación y el Control',
            objetivo: data.dataPlanAuditoria.Data?.objetivo || '',
            alcance: data.dataPlanAuditoria.Data?.alcance || '',
            criterios: data.dataPlanAuditoria.Data?.criterio || '',
            recursos: data.dataPlanAuditoria.Data?.recurso || '',
            items: items,
        };

        return json;
    }
    private organizarItems(data: any): PlantillaDto {
        const idMesMap = {
            6779: 'enero',
            6780: 'febrero',
            6781: 'marzo',
            6782: 'abril',
            6783: 'mayo',
            6784: 'junio',
            6785: 'julio',
            6786: 'agosto',
            6787: 'septiembre',
            6788: 'octubre',
            6789: 'noviembre',
            6795: 'diciembre',
        };

        const mesesMarcados = Object.keys(idMesMap).reduce((acc, id) => {
            acc[idMesMap[id]] = '';
            return acc;
        }, {} as { [key: string]: string });

        (data.cronograma_id || []).forEach((id: number) => {
            const mes = idMesMap[id];
            if (mes) {
                mesesMarcados[mes] = 'marcado';
            } else {
                mesesMarcados[mes] = '';
            }

        });

        return {
            actividad: data.titulo || '',
            ...mesesMarcados,
        };
    }

    private async renderizar(data: jsonPlantillaDto) {
        const apiUrl = `${environment.PLANTILLAS_MID_SERVICE}`;
        let urlPlanAuditoria = `${apiUrl}/v1/plantilla/renderizar`;
        try {
            const response = await lastValueFrom(
                this.httpService.post(urlPlanAuditoria, data)
            );
            return response.data;
        } catch (error) {
            console.error('Error al enviar data:', error);
            throw new Error('No se pudo enviar el plan');
        }
    }
}
