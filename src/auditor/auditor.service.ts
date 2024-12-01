import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

@Injectable()
export class AuditorService {
    private documento:any;
    private asignadoPor:any;
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    async getdAll(queryParams: any) {
        let data = await this.traerDataCrud(null, queryParams);
        console.log("DATA---", data)

        await this.reemplazarCampos(data);
        return data;
    }

    async getOne(id: string) {
        const data = await this.traerDataCrud(id, null);
        await this.reemplazarCampos(data);

        return data;
    }

    private async traerTercero(documento: string) {
        const apiUrl = `${environment.TERCEROS_SERVICE}`;
        const url = `${apiUrl}/tercero/${documento}`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );

        }
    }

    private async traerDataCrud(id: string | null, queryParams: any) {
        const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
        let url = `${apiUrl}auditor/`;
        if (id != null && id != undefined) {
            url = url + `${id}`;
        }
        if (queryParams) {
            const queryString = new URLSearchParams(queryParams).toString();
            url += `?${queryString}`;
        }
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );

        }
    }

    private async reemplazarCampos(data: any) {
        const procesarElemento = async (elemento: any) => {
            if (elemento?.documento_id) {
                const tercero = await this.traerTercero(elemento.documento_id);
                this.reemplazar(tercero, elemento, 'documento_id');
            }
    
            if (elemento?.asignado_por_id) {
                const asignadoPor = await this.traerTercero(elemento.asignado_por_id);
                this.reemplazar(asignadoPor, elemento, 'asignado_por_id');
            }
        };
    
        if (Array.isArray(data?.Data)) {
            for (const elemento of data.Data) {
                await procesarElemento(elemento);
            }
        } else if (typeof data?.Data === 'object' && data.Data !== null) {
            await procesarElemento(data.Data);
        }
    
        return data;
    }

    private reemplazar(arrayTercero: any[], elemento: any, campo: string) {
        const elementoData = elemento[campo];

        if (!Array.isArray(arrayTercero)) {
            arrayTercero = [arrayTercero];
        }
        const nuevoCampo = campo.endsWith('_id') ? campo.replace('_id', '_nombre') : `${campo}_nombre_completo`;
        if (Array.isArray(elementoData)) {
            elemento[nuevoCampo] = elementoData.map((doc) => {
                const encontrado = arrayTercero.find((param) => param.Id === doc);
                return encontrado ? encontrado.NombreCompleto : doc;
            });
        } else {
            const encontrado = arrayTercero.find((param) => param.Id === elementoData);

            if (encontrado) {
                elemento[nuevoCampo] = encontrado.NombreCompleto;
            } else {
                console.warn(`No se encontró ${campo} para ID: ${elementoData}`);
                elemento[nuevoCampo] = null;
            }
        }
        console.log("elemento ",elemento)
        return elemento;
    }
}
