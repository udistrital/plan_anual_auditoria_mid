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
        const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_CRUD}`;
        let urlPlanAuditoria = `${apiUrl}plan-auditoria/${id}`;
        let urlAuditioria = `${apiUrl}auditoria?plan_auditoria_id:${id}&fields=titulo,cronograma_id`;
        try {
            const responsePlanAuditoria = await lastValueFrom(this.httpService.get(urlPlanAuditoria));
            let dataPlanAuditoria = responsePlanAuditoria.data

            const responseAuditoria = await lastValueFrom(this.httpService.get(urlAuditioria));
            let dataAuditoria = responseAuditoria.data

            return { dataPlanAuditoria, dataAuditoria }
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );

        }
    }

    private async organizarData(data: any) {
        const json = new jsonPlantillaDto();
        const items: PlantillaDto[] = data.dataAuditoria.map((data: any) => this.organizarItems(data));

        json.plantilla_id = '';
        json.data = {
            codigo: data.dataPlanAuditoria.codigo,
            proceso: '',
            objetivo: '',
            alcance: '',
            criterios: '',
            recursos: '',
            items: items,

        };
        return json;
    }
    private organizarItems(data: any): PlantillaDto {
        const items = new PlantillaDto();
        items.actividad = data.titulo;

        const mesesMap = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        data.cronograma_id.forEach((mesIndex: number) => {
            const mes = mesesMap[mesIndex - 1];
            if (mes) {
                items[mes] = 'marcado';
            }
        });

        return items;
    }

    private async renderizar(data: jsonPlantillaDto) {
        const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_PLANTILLAS}`;
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
