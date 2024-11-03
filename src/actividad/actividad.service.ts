import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

@Injectable()
export class ActividadService {
    private medio: any[] = [];

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    async getdAll() {
        const data = await this.traerDataCrud(null);
        //console.log(data);
        /*if ((!data || !data.Data || data.Data.length === 0)) {
            return null;
        }*/

        if (await this.identificarCampo(data)) {
            console.log("vuelve")
            this.reemplazarCampos(data);

        }
        return data;

    }

    async getOne(id: string) {
        const data = await this.traerDataCrud(id);

        return data;
    }

    private async identificarCampo(data: any) {
        const firstElement = data.Data[0];
        //console.log(firstElement)
        let validacion = false;
        try {
            if ("medioId" in firstElement) {
                let param = await this.traerParametros("136")
                this.medio.push(...param);
                console.log("medio: ", this.medio);
                validacion = true;
            }

            return validacion;
        } catch (error) {
            console.error(error)
        }

    }


    private async traerParametros(idParam: string) {

        const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_PARAMETROS}`;
        const url = `${apiUrl}/parametro?query=TipoParametroId:${idParam}&fields=Id,Nombre`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data.Data;
        } catch (error) {
            // Maneja los errores si la solicitud falla
            throw new HttpException(
                'Error al obtener los datos del servicio externo',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );

        }
        //identificar si hay data
        //identificar si el campo a reemplazar con parametros existe
    }

    private async traerDataCrud(id: string | null) {
        const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_CRUD}`;
        let url = `${apiUrl}actividad/`;

        if (id != null && id != undefined) {
            url = url + `${id}`;
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

    private reemplazarCampos(data: any) {
        console.log("Entra a reemplazarCampos");

        if (Array.isArray(data.Data)) {
            data.Data.forEach(element => {
                if (element.tipoEvaluacionId !== undefined) {
                    this.reemplazar(this.medio, element, 'tipoEvaluacionId');
                }
            });
        } 

        return data;
    }

    private reemplazar(array: any[], element: any, campo: string) {
        const value = element[campo];

        if (Array.isArray(value)) {
            element[campo] = value.map(id => {
                const encontrado = array.find(param => param.Id === id);
                if (encontrado) {
                    return encontrado.Nombre; 
                } else {
                    return id;
                }
            });
        } else {
            const encontrado = array.find(param => param.Id === value);
            if (encontrado) {
                element[campo] = encontrado.Nombre; 
            } else {
                console.warn(`no se encontro ${campo} para ID: ${value}`);
            }
        }
    }
}
