import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { Console, log } from 'console';

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
  ) { }

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

  async getAuditoriasOrdenadas(queryParams: any) {
    const match = queryParams.query.match(/plan_auditoria_id:([^,]+)/);
    const planId = match ? match[1] : null;
  
    // Validar que el planId se haya encontrado
    if (!planId) {
      throw new HttpException(
        'El parámetro "plan_auditoria_id" es obligatorio.',
        HttpStatus.BAD_REQUEST,
      );
    }
  
    const data = await this.traerDataCrud(null, queryParams);
  
    if (data.Data && Array.isArray(data.Data)) {
      const auditoriasActivas = data.Data.filter(
        (auditoria) => auditoria.activo === true,
      );
  
      // Obtener el campo "auditorias" del plan
      const planData = await this.obtenerPlanPorId(planId);
      const auditoriasOrden = planData?.auditorias || [];
  
      // Ordenar las auditorías activas según el campo "auditorias" del plan
      data.Data = this.ordenarAuditorias(auditoriasActivas, auditoriasOrden);
  
      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }
    }
  
    return data;
  }
  

  private async obtenerPlanPorId(planId: string) {
    const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
    const url = `${apiUrl}plan-auditoria/${planId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data;
    } catch (error) {
      console.error('Error al obtener el plan:', error);
      throw new HttpException(
        'Error al obtener el plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private ordenarAuditorias(auditorias: any[], auditoriasOrden: string[]) {
    const auditoriasMap = new Map(
      auditorias.map((auditoria) => [auditoria._id, auditoria]),
    );

    // Ordenar las auditorías según el orden de los IDs en auditoriasOrden
    const auditoriasOrdenadas = auditoriasOrden
      .map((id) => auditoriasMap.get(id))
      .filter((auditoria) => auditoria !== undefined);

    // Agregar al final las auditorías activas no incluidas en auditoriasOrden
    const restantes = auditorias.filter(
      (auditoria) => !auditoriasOrden.includes(auditoria._id),
    );

    return [...auditoriasOrdenadas, ...restantes];
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;

      if ('tipo_evaluacion_id' in firstElement) {
        let param = await this.traerParametros('136');
        this.tiposEvaluacion.push(...param);
        validacion = true;
      }

      if ('cronograma_id' in firstElement) {
        let param = await this.traerParametros('139');
        this.cronogramasActividad.push(...param);
        validacion = true;
      }

      if ('estado_id' in firstElement) {
        validacion = true;
      }

      if ('tipo_id' in firstElement) {
        let param = await this.traerParametros('139');
        this.tipos.push(...param);
        validacion = true;
      }

      if ('macroproceso' in firstElement) {
        let param = await this.traerParametros('139');
        this.macroprocesos.push(...param);
        validacion = true;
      }

      if ('lider_id' in firstElement) {
        let param = await this.traerParametros('139');
        this.lideres.push(...param);
        validacion = true;
      }

      if ('responsable_id' in firstElement) {
        let param = await this.traerParametros('139');
        this.responsables.push(...param);
        validacion = true;
      }

      if ('vigencia_id' in firstElement) {
        let param = await this.traerParametros('121');
        this.vigencias.push(...param);
        validacion = true;
      }

      return validacion;
    } catch (error) {
      console.error(error);
    }
  }

  private async traerParametros(idParam: string) {
    const apiUrl = `${environment.PARAMETROS_SERVICE}`;
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
    const apiUrl = `${environment.PLAN_AUDITORIA_CRUD_SERVICE}`;
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
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element) => {
        if (element.tipo_evaluacion_id !== undefined) {
          this.reemplazar(this.tiposEvaluacion, element, 'tipo_evaluacion_id');
        }
        if (element.cronograma_id !== undefined) {
          this.reemplazar(this.cronogramasActividad, element, 'cronograma_id');
        }
        if (element.estado_id !== undefined) {
          this.reemplazar(this.estados, element, 'estado_id');
        }
        if (element.tipo_id !== undefined) {
          this.reemplazar(this.tipos, element, 'tipo_id');
        }
        if (element.vigencia_id !== undefined) {
          this.reemplazar(this.vigencias, element, 'vigencia_id');
        }
        if (element.macroproceso !== undefined) {
          this.reemplazar(this.macroprocesos, element, 'macroproceso');
        }
        if (element.lider_id !== undefined) {
          this.reemplazar(this.lideres, element, 'lider_id');
        }
        if (element.responsable_id !== undefined) {
          this.reemplazar(this.responsables, element, 'responsable_id');
        }
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.tipo_evaluacion_id !== undefined) {
        this.reemplazar(this.tiposEvaluacion, data.Data, 'tipo_evaluacion_id');
      }
      if (data.Data.cronograma_id !== undefined) {
        this.reemplazar(this.cronogramasActividad, data.Data, 'cronograma_id');
      }
      if (data.Data.estado_id !== undefined) {
        this.reemplazar(this.estados, data.Data, 'estado_id');
      }
      if (data.Data.tipo_id !== undefined) {
        this.reemplazar(this.tipos, data.Data, 'tipo_id');
      }
      if (data.Data.vigencia_id !== undefined) {
        this.reemplazar(this.vigencias, data.Data, 'vigencia_id');
      }
      if (data.Data.macroproceso !== undefined) {
        this.reemplazar(this.macroprocesos, data.Data, 'macroproceso');
      }
      if (data.Data.lider_id !== undefined) {
        this.reemplazar(this.lideres, data.Data, 'lider_id');
      }
      if (data.Data.responsable_id !== undefined) {
        this.reemplazar(this.responsables, data.Data, 'responsable_id');
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
