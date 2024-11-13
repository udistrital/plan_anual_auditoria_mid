import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

@Injectable()
export class PlanAuditoriaService {
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    async getdAll(queryParams: any) {
        const data = await this.traerDataCrud(null, queryParams);
        return data;

    }

    async getOne(id: string) {
        const data = await this.traerDataCrud(id, null);
        return data;
    }

    private async traerDataCrud(id: string | null, queryParams: any) {
        const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_CRUD}`;
        let url = `${apiUrl}plan-auditoria/`;
        if (id != null && id != undefined) {
            url += `${id}`;
        }
        if (queryParams) {
            const queryString = new URLSearchParams(queryParams).toString();
            url += `?${queryString}`;
        }

        try {
            const response = await lastValueFrom(this.httpService.get(url));
            //console.log("data: ", response.data)
            return response.data;
        } catch (error) {
            // Maneja los errores si la solicitud falla
            throw new HttpException(
                'Error al obtener los datos del servicio externo',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
