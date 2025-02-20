import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

const {
  TERCEROS_SERVICE,
  PARAMETROS_SERVICE,
  PLAN_AUDITORIA_CRUD_SERVICE,
  TIPO_PARAMETRO,
  PLAN_ESTADO
} = environment;

@Injectable()
export class PlanAuditoriaService {
  private vigencias: any[] = [];
  private estados: any[] = [];

  constructor(private readonly httpService: HttpService) {}

  async getAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    const data = await this.traerDataCrud(id, null);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  private async traerTercero(documento: string) {
    const apiUrl = `${TERCEROS_SERVICE}`;
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

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
      if ('vigencia_id' in firstElement) {
        let param = await this.traerParametros(TIPO_PARAMETRO.VIGENCIA);
        this.vigencias.push(...param);
        validacion = true;
      }

      if ('estado' in firstElement && firstElement.estado !== null) {
        const estadoId = firstElement.estado.estado_id;
        if (estadoId) {
          let paramEstado = await this.traerParametros(TIPO_PARAMETRO.ESTADOS);
          this.estados.push(...paramEstado);
        }
        validacion = true;
      }
      return validacion;
    } catch (error) {
      console.warn('Error en identificarCampo:', error);
    }
  }

  private async traerParametros(idParam: number) {
    const apiUrl = `${PARAMETROS_SERVICE}`;
    const url = `${apiUrl}/parametro?query=TipoParametroId:${idParam}&fields=Id,Nombre&limit=0`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async traerDataCrud(id: string | null, queryParams: any) {
    const apiUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}`;
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

      if (Array.isArray(response.data.Data)) {
        for (let plan of response.data.Data) {
          const estado = await this.traerEstadoPorPlan(plan._id);
          if (estado && estado.actual) {
            plan.estado = estado;
          }

          const tieneRechazos = await this.traerMotivosRechazo(plan._id, PLAN_ESTADO.RECHAZADO);
          plan.tiene_rechazos = tieneRechazos;

          if (plan.creado_por_id) {
            const tercero = await this.traerTercero(plan.creado_por_id);
            plan.creado_por_nombre = tercero?.NombreCompleto || null;
          }
        }
      } else if (response.data.Data && response.data.Data._id) {
        const estado = await this.traerEstadoPorPlan(response.data.Data._id);
        if (estado && estado.actual) {
          response.data.Data.estado = estado;
        }
      }
      return response.data;
    } catch (error) {
      // Maneja los errores si la solicitud falla
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async traerMotivosRechazo(planAuditoriaId: string, estadoId: number) {
    const apiUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}`;
    const url = `${apiUrl}estado?query=plan_auditoria_id:${planAuditoriaId},estado_id:${estadoId},activo:true&limit=1&fields=_id`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      if (response.data.MetaData.Count) {
        return true;
      }
      return false;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del estado',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async traerEstadoPorPlan(planAuditoriaId: string) {
    const apiUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}`;
    const url = `${apiUrl}estado?query=plan_auditoria_id:${planAuditoriaId},actual:true`;

    try {
      const response = await lastValueFrom(this.httpService.get(url));

      if (
        response.data &&
        response.data.Data &&
        response.data.Data.length > 0
      ) {
        return response.data.Data[0];
      }
      return null;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del estado',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element) => {
        if (element.vigencia_id !== undefined) {
          this.reemplazar(this.vigencias, element, 'vigencia_id');
        }

        if (element.estado && element.estado.estado_id !== undefined) {
          this.reemplazar(this.estados, element.estado, 'estado_id');
        }
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.vigencia_id !== undefined) {
        this.reemplazar(this.vigencias, data.Data, 'vigencia_id');
      }

      if (data.Data.estado && data.Data.estado.estado_id !== undefined) {
        this.reemplazar(this.estados, data.Data.estado, 'estado_id');
      }
    }
    return data;
  }

  private reemplazar(array: any[], element: any, campo: string) {
    const value = element[campo];

    //se realiza reemplazo de sufijo _id si existe, por _nombre
    const nuevoCampo = campo.endsWith('_id')
      ? campo.replace('_id', '_nombre')
      : `${campo}_nombre`;

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
