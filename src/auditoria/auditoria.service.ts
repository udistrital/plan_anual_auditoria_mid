import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';
import { environment } from 'src/config/configuration';

@Injectable()
export class AuditoriaService {
  private tiposEvaluacion: any[] = [];
  private cronogramasActividad: any[] = [];
  private estados: { Id: number; Nombre: string }[] = [
    { Id: 1, Nombre: 'Activo' },
    { Id: 2, Nombre: 'Inactivo' },
    { Id: 3, Nombre: 'Otro' },
  ];
  private tipos: any[] = [];
  private macroprocesos: any[] = [];
  private lideres: any[] = [];
  private responsables: any[] = [];
  private vigencias: any[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getdAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
    //console.log(data);
    /*if ((!data || !data.Data || data.Data.length === 0)) {
            return null;
        }*/

    if (await this.identificarCampo(data)) {
      console.log('vuelve');
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    const data = await this.traerDataCrud(id, null);
    if (await this.identificarCampo(data)) {
      console.log('vuelve');
      this.reemplazarCampos(data);
    }
    return data;
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;

      if ('tipoEvaluacionId' in firstElement) {
        let param = await this.traerParametros('136');
        this.tiposEvaluacion.push(...param);
        console.log('tiposEvaluacion: ', this.tiposEvaluacion);
        validacion = true;
      }

      if ('cronogramaId' in firstElement) {
        let param = await this.traerParametros('139');
        this.cronogramasActividad.push(...param);
        validacion = true;
      }

      if ('estadoId' in firstElement) {
        validacion = true;
      }

      if ('vigencia_id' in firstElement) {
        let param = await this.traerParametros('121');
        this.vigencias.push(...param);
        validacion = true;
      }

      if ('tipoId' in firstElement) {
        let param = await this.traerParametros('139');
        this.tipos.push(...param);
        validacion = true;
      }

      if ('macroproceso' in firstElement) {
        let param = await this.traerParametros('139');
        this.macroprocesos.push(...param);
        validacion = true;
      }

      if ('liderId' in firstElement) {
        let param = await this.traerParametros('139');
        this.lideres.push(...param);
        validacion = true;
      }

      if ('responsableId' in firstElement) {
        let param = await this.traerParametros('139');
        this.responsables.push(...param);
        validacion = true;
      }
      return validacion;
    } catch (error) {
      console.error(error);
    }
  }

  private async traerParametros(idParam: string) {
    const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_PARAMETROS}`;
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
    //identificar si hay data
    //identificar si el campo a reemplazar con parametros existe
  }

  private async traerDataCrud(id: string | null, queryParams: any) {
    const apiUrl = `${environment.PLAN_ANUAL_AUDITORIA_CRUD}`;
    let url = `${apiUrl}auditoria/`;

    if (id != null && id != undefined) {
      url = url + `${id}`;
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

  private reemplazarCampos(data: any) {
    //console.log("Entra a reemplazarCampos");
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element) => {
        if (element.tipoEvaluacionId !== undefined) {
          this.reemplazar(this.tiposEvaluacion, element, 'tipoEvaluacionId');
        }
        if (element.cronogramaId !== undefined) {
          this.reemplazar(this.cronogramasActividad, element, 'cronogramaId');
        }
        if (element.estadoId !== undefined) {
          this.reemplazar(this.estados, element, 'estadoId');
        }
        if (element.tipoId !== undefined) {
          this.reemplazar(this.tipos, element, 'tipoId');
        }
        if (element.vigencia_id !== undefined) {
          this.reemplazar(this.vigencias, element, 'vigencia_id');
        }
        if (element.macroproceso !== undefined) {
          this.reemplazar(this.macroprocesos, element, 'macroproceso');
        }
        if (element.liderId !== undefined) {
          this.reemplazar(this.lideres, element, 'liderId');
        }
        if (element.responsableId !== undefined) {
          this.reemplazar(this.responsables, element, 'responsableId');
        }
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.tipoEvaluacionId !== undefined) {
        this.reemplazar(this.tiposEvaluacion, data.Data, 'tipoEvaluacionId');
      }
      if (data.Data.cronogramaId !== undefined) {
        this.reemplazar(this.cronogramasActividad, data.Data, 'cronogramaId');
      }
      if (data.Data.estadoId !== undefined) {
        this.reemplazar(this.estados, data.Data, 'estadoId');
      }
      if (data.Data.tipoId !== undefined) {
        this.reemplazar(this.tipos, data.Data, 'tipoId');
      }
      if (data.Data.macroproceso !== undefined) {
        this.reemplazar(this.macroprocesos, data.Data, 'macroproceso');
      }
      if (data.Data.liderId !== undefined) {
        this.reemplazar(this.lideres, data.Data, 'liderId');
      }
      if (data.Data.responsableId !== undefined) {
        this.reemplazar(this.responsables, data.Data, 'responsableId');
      }
    }

    return data;
  }

  private reemplazar(array: any[], element: any, campo: string) {
    const value = element[campo];

    if (Array.isArray(value)) {
      element[campo] = value.map((id) => {
        const encontrado = array.find((param) => param.Id === id);
        return encontrado ? encontrado.Nombre : id;
      });
    } else {
      const encontrado = array.find((param) => param.Id === value);
      if (encontrado) {
        element[campo] = encontrado.Nombre;
      } else {
        console.warn(`no se encontro ${campo} para ID: ${value}`);
      }
    }
    return element;
  }
}
