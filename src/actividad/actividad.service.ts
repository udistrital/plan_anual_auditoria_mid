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
            if (firstElement && "medioId" in firstElement) {
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
    }

    private async traerDataCrud(id: string | null, queryParams: any) {
        const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_CRUD}`;
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
                if (element.medioId !== undefined) {
                    this.reemplazar(this.medio, element, 'medioId');
                }
            });
        }else if (typeof data.Data === 'object' && data.Data !== null) {
            if (data.Data.medioId !== undefined) {
                this.reemplazar(this.medio, data.Data, 'medioId');
            }
        }
        return data;
    }

    private reemplazar(array: any[], element: any, campo: string) {
        const value = element[campo];

        if (Array.isArray(value)) {
            element[campo] = value.map(id => {
                const encontrado = array.find(param => param.Id === id);
                return encontrado ? encontrado.Nombre : id;
            });
        } else {
            const encontrado = array.find(param => param.Id === value);
            if (encontrado) {
                element[campo] = encontrado.Nombre;
            } else {
                console.warn(`no se encontro ${campo} para ID: ${value}`);
            }
        }
        //console.log("reemplazo ",element)
        return element;

    }
}
