import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

@Injectable()
export class ActividadService {
    // private medio: any[] = [];
    private medio: { Id: number; Nombre: string }[] = [
        { Id: 1, Nombre: "Digital" },
        { Id: 2, Nombre: "Fisico" },
        { Id: 3, Nombre: "Otro" },
    ];
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    async getdAll(queryParams: any) {
        const data = await this.traerDataCrud(null, queryParams);
        //console.log(data);
        /*if ((!data || !data.Data || data.Data.length === 0)) {
            return null;
        }*/

        if (await this.identificarCampo(data)) {

            this.reemplazarCampos(data);

        }
        return data;

    }

    async getOne(id: string) {
        const data = await this.traerDataCrud(id,null);
        if (await this.identificarCampo(data)) {
            this.reemplazarCampos(data);
        }
        return data;
    }

    private async identificarCampo(data: any) {
        
        let validacion = false;
        try {
            const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
            //console.log(firstElement)
            if (firstElement && "medio_id" in firstElement) {
                //let param = this.medio
                //let param = await this.traerParametros("136")
                //this.medio.push(...param);
                validacion = true;
            }
            return validacion;
        } catch (error) {
            console.error(error)
        }

    }


    private async traerParametros(idParam: string) {

        const apiUrl = `${environment.PARAMETROS_SERVICE}`;
        const url = `${apiUrl}/parametro?query=TipoParametroId:${idParam}&fields=Id,Nombre&limit=0`;
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
    }

    private async traerDataCrud(id: string | null, queryParams: any) {
        const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
        let url = `${apiUrl}actividad/`;

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

    private reemplazarCampos(data: any) {
        //console.log("Entra a reemplazarCampos");
        if (Array.isArray(data.Data)) {
            data.Data.forEach(element => {
                if (element.medio_id !== undefined) {
                    this.reemplazar(this.medio, element, 'medio_id');
                }
            });
        }else if (typeof data.Data === 'object' && data.Data !== null) {
            if (data.Data.medio_id !== undefined) {
                this.reemplazar(this.medio, data.Data, 'medio_id');
            }
        }
        return data;
    }

    private reemplazar(array: any[], element: any, campo: string) {
        const value = element[campo];

        //se realiza reemplazo de sufijo _id si existe, por _nombre
        const nuevoCampo = campo.endsWith('_id') ? campo.replace('_id', '_nombre') : `${campo}_nombre`;

        if (Array.isArray(value)) {
            element[nuevoCampo] = value.map((id) => {
                const encontrado = array.find((param) => param.Id === id);
                return encontrado ? encontrado.Nombre : id;
            });
        } else {
            const encontrado = array.find((param) => param.Id === value);
            if (encontrado) {
                element[nuevoCampo] = encontrado.Nombre;
            } else {
                console.warn(`No se encontró ${campo} para ID: ${value}`);
                element[nuevoCampo] = null;
            }
        }

        return element;
    }
}
