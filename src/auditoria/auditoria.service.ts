import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditorService } from '../auditor/auditor.service';
import { unirListaNombresConComas } from 'src/utils/texto.utils';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  PARAMETROS_SERVICE,
  TIPO_PARAMETRO,
  TERCEROS_SERVICE,
  OIKOS_SERVICE,
} = environment;

@Injectable()
export class AuditoriaService {
  private tiposEvaluacion: any[] = [];
  private cronogramasActividad: any[] = [];
  private macroprocesos: any[] = [];
  private procesos: any[] = [];
  private dependencias: any[] = [];
  private lideres: any[] = [];
  private responsables: any[] = [];
  private vigencias: any[] = [];
  private correos: any = {};
  private estados: { Id: number; Nombre: string }[] = [
    { Id: 1, Nombre: 'Activo' },
    { Id: 2, Nombre: 'Inactivo' },
    { Id: 3, Nombre: 'Otro' },
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly auditorService: AuditorService,
  ) { }

  async getAll(queryParams: any) {
    const data = await this.traerDataCrud(null, queryParams);
    await Promise.all(
      data.Data.map(async (auditoria: any) => {
        const [estado, auditores] = await Promise.all([
          this.getEstadoAuditoria(auditoria._id),
          this.asociarAuditores(auditoria._id),
        ]);

        if (estado?.actual) {
          auditoria.estado = estado;
          auditoria.estado_id = estado.estado_id;
        }
        auditoria.auditores = auditores || [];
      }),
    );
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByAuditor(personaId: string, queryParams: any) {
    console.log('queryParams recibidos:', queryParams);
    // Separar estado_id de los demás parámetros
    const { estado_id, ...crudParams } = queryParams;

    // Remover estado_id del string query si existe
    if (crudParams.query) {
      crudParams.query = crudParams.query
        .split(',')
        .filter((param: string) => !param.startsWith('estado_id:'))
        .join(',');
    }

    console.log('estado_id extraido:', estado_id);
    console.log('crudParams para CRUD:', crudParams);

    const data = await this.traerDataCrudByAuditor(personaId, crudParams);
    console.log('Data recibida del CRUD:', data);

    await Promise.all(
      data.Data.map(async (auditoria: any) => {
        const [estado, auditores] = await Promise.all([
          this.getEstadoAuditoria(auditoria._id),
          this.asociarAuditores(auditoria._id),
        ]);

        if (estado?.actual) {
          auditoria.estado = estado;
          auditoria.estado_id = estado.estado_id;
        }
        auditoria.auditores = auditores || [];
      }),
    );

    console.log('Auditorías antes del filtro:', data.Data.map(a => ({ _id: a._id, titulo: a.titulo, estado_id: a.estado_id })));
    console.log('Total antes del filtro:', data.Data.length);

    // Filtrar por estado_id si se proporciona y no está vacío
    if (estado_id && estado_id !== '') {
      const estadoId = parseInt(estado_id);
      console.log('Filtrando por estado_id:', estadoId);
      data.Data = data.Data.filter((auditoria: any) => auditoria.estado_id === estadoId);
      data.MetaData.Count = data.Data.length;
      console.log('Auditorías después del filtro:', data.Data.map(a => ({ _id: a._id, titulo: a.titulo, estado_id: a.estado_id })));
      console.log('Total después del filtro:', data.Data.length);
    }

    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getByDependencia(personaId: number, cargoId: number, queryParams: any) {
    const dependenciaIds = await this.getDependenciasByPersona(personaId, cargoId);

    if (!dependenciaIds || dependenciaIds.length === 0) {
      return {
        Success: true,
        Status: 200,
        Message: 'Sin auditorías para las dependencias del usuario',
        Data: [],
        MetaData: { Count: 0 },
      };
    }

    const dependenciasFilter = dependenciaIds.join('|');
    const baseQuery = queryParams.query || '';

    const additionalFilters = `dependencia_id__in:${dependenciasFilter}`;
    queryParams.query = baseQuery ? `${baseQuery},${additionalFilters}` : additionalFilters;

    const data = await this.traerDataCrud(null, queryParams);
    if (data.Data && Array.isArray(data.Data) && data.Data.length > 0) {
      const dependenciaNombres = await this.getDependenciaNombres(dependenciaIds);

      await Promise.all(
        data.Data.map(async (auditoria: any) => {
          const estado = await this.getEstadoAuditoria(auditoria._id);

          if (estado?.actual) {
            auditoria.estado = estado;
            auditoria.estado_id = estado.estado_id;
          }
          auditoria.dependencia_nombre = dependenciaNombres.get(auditoria.dependencia_id) || null;
        }),
      );

      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }
    }

    return data;
  }

  private async getDependenciasByPersona(personaId: number, cargoId: number): Promise<number[]> {
    const url = `${TERCEROS_SERVICE}vinculacion?query=TerceroPrincipalId:${personaId},Activo:true,CargoId:${cargoId}&fields=DependenciaId`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));

      if (!response.data || response.data.length === 0) {
        return [];
      }
      return response.data.map((v: any) => v.DependenciaId).filter((id: any) => id != null);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las dependencias del usuario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getDependenciaNombres(dependenciaIds: number[]): Promise<Map<number, string>> {
    const nombresMap = new Map<number, string>();
    await Promise.all(
      dependenciaIds.map(async (id) => {
        try {
          const url = `${OIKOS_SERVICE}dependencia/${id}`;
          const response = await lastValueFrom(this.httpService.get(url));
          if (response.data?.Nombre) {
            nombresMap.set(id, response.data.Nombre);
          }
        } catch (error) {
          // Si no se puede obtener el nombre, se omite
        }
      }),
    );
    return nombresMap;
  }

  async getOne(id: string) {
    const data = await this.traerDataCrud(id, null);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getEmails(dependencia_id: number) {
    const correo_lider = await this.traerCorreoTerceroVinculado(
      dependencia_id,
      environment.CARGO.JEFE_DEPENDENCIA_ID,
    );

    const correo_responsable = await this.traerCorreoTerceroVinculado(
      dependencia_id,
      environment.CARGO.ASISTENTE_DEPENDENCIA_ID,
    );

    const correo_dependencia = this.traerCorreoDependencia(dependencia_id);
    return { correo_lider: correo_lider, correo_responsable: correo_responsable, correo_dependencia: correo_dependencia };
  }

  async traerCorreoTerceroVinculado(dependenciaId: number, cargoId: number): Promise<String> {
    const url = `${TERCEROS_SERVICE}vinculacion?query=Activo:true,DependenciaId:${dependenciaId},CargoId:${cargoId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const vinculacion = response.data[0];
      return vinculacion?.TerceroPrincipalId?.UsuarioWSO2 || 'Correo no encontrado';
    } catch (error) {
      throw new HttpException(
        'Error al traer el tercero vinculado',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error
      );
    }
  }

  traerCorreoDependencia(dependenciaId: number): String {
    const dependencia = this.dependencias.find(dep => dep.Id === dependenciaId);
    return dependencia ? dependencia.CorreoElectronico : 'Correo no encontrado';
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

      // Obtener el estado de cada auditoría activa
      auditoriasActivas.forEach(async (auditoria: any) => {
        const estado = await this.getEstadoAuditoria(auditoria._id);
        if (estado?.actual) {
          auditoria.estado_id = estado.estado_id;
        }
      });

      // Obtener el campo "auditorias" del plan
      const planData = await this.obtenerPlanPorId(planId);
      const auditoriasOrden = planData?.auditorias || [];

      // Ordenar las auditorías activas según el campo "auditorias" del plan
      data.Data = this.ordenarAuditorias(auditoriasActivas, auditoriasOrden);

      // Reemplazar campos ANTES de aplicar ordenamiento personalizado
      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }

      // Aplicar ordenamiento adicional si se especifica
      const { orderBy, orderDirection } = queryParams;
      if (orderBy) {
        data.Data = this.aplicarOrdenamiento(data.Data, orderBy, orderDirection);
      }
    }
    return data;
  }

  private aplicarOrdenamiento(auditorias: any[], orderBy: string, orderDirection: string = 'ASC') {
    return auditorias.sort((a, b) => {
      let valorA, valorB;

      if (orderBy === 'tipo_evaluacion') {
        valorA = (a.tipo_evaluacion_nombre || '').toLowerCase();
        valorB = (b.tipo_evaluacion_nombre || '').toLowerCase();
      } else if (orderBy === 'titulo') {
        valorA = (a.titulo || '').toLowerCase();
        valorB = (b.titulo || '').toLowerCase();
      } else {
        return 0;
      }

      if (valorA < valorB) return orderDirection === 'ASC' ? -1 : 1;
      if (valorA > valorB) return orderDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  private async obtenerPlanPorId(planId: string) {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${planId}`;
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

    const auditoriasTotales = [...auditoriasOrdenadas, ...restantes];
    return auditoriasTotales;
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;

      if (!firstElement) {
        return false;
      }

      if ('tipo_evaluacion_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.TIPO_EVALUACION);
        this.tiposEvaluacion.push(...param);
        validacion = true;
      }

      if ('cronograma_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.CRONOGRAMA);
        this.cronogramasActividad.push(...param);
        validacion = true;
      }

      if ('estado_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.AUDITORIA_ESTADO);
        this.estados.push(...param);
        validacion = true;
      }

      if ('macroproceso_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.MACROPROCESO);
        this.macroprocesos.push(...param);
        validacion = true;
      }

      if ('proceso_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.PROCESO);
        this.procesos.push(...param);
        validacion = true;
      }

      if ('lider_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.CARGO_LIDER);
        this.lideres.push(...param);
        validacion = true;
      }

      if ('responsable_id' in firstElement) {
        const param = await this.traerParametros(
          TIPO_PARAMETRO.CARGO_RESPONSABLE,
        );
        this.responsables.push(...param);
        validacion = true;
      }

      if ('vigencia_id' in firstElement) {
        const param = await this.traerParametros(TIPO_PARAMETRO.VIGENCIA);
        this.vigencias.push(...param);
        validacion = true;
      }

      if ('dependencia_id' in firstElement) {
        const param = await this.traerDependencias();
        this.dependencias.push(...param);
        this.correos = await this.getEmails(firstElement.dependencia_id);
        validacion = true;
      }
      return validacion;
  }

  private async traerParametros(idParam: number) {
    const url = `${PARAMETROS_SERVICE}/parametro?query=TipoParametroId:${idParam}&fields=Id,Nombre&limit=0`;
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

  private async traerDependencias() {
    const url = `${OIKOS_SERVICE}dependencia?query=Activo:true&fields=Id,Nombre,CorreoElectronico&limit=0`;
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
    let url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/`;
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

  private async traerDataCrudByAuditor(personaId: string, queryParams: any) {
    let url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria/auditor/${personaId}`;
    if (queryParams) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }
    console.log('URL llamada al CRUD:', url);
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

  private async getEstadoAuditoria(auditoriaId: string) {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria-estado?query=auditoria_id:${auditoriaId},actual:true`;
    try {
      const { data } = await lastValueFrom(this.httpService.get(url));
      if (data?.Data?.length > 0) {
        return data.Data[0];
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
        if (element.tipo_evaluacion_id !== undefined) {
          this.reemplazar(this.tiposEvaluacion, element, 'tipo_evaluacion_id');
        }
        if (element.cronograma_id !== undefined) {
          this.reemplazar(this.cronogramasActividad, element, 'cronograma_id');
        }
        if (element.estado_id !== undefined) {
          this.reemplazar(this.estados, element, 'estado_id');
        }
        if (element.macroproceso_id !== undefined) {
          this.reemplazar(this.macroprocesos, element, 'macroproceso_id');
        }
        if (element.vigencia_id !== undefined) {
          this.reemplazar(this.vigencias, element, 'vigencia_id');
        }
        if (element.proceso_id !== undefined) {
          this.reemplazar(this.procesos, element, 'proceso_id');
        }
        if (element.lider_id !== undefined) {
          this.reemplazar(this.lideres, element, 'lider_id');
        }
        if (element.responsable_id !== undefined) {
          this.reemplazar(this.responsables, element, 'responsable_id');
        }
        if (element.dependencia_id !== undefined) {
          this.reemplazar(this.dependencias, element, 'dependencia_id');
        }

        element.cronograma = this.unirCronogramaNombres(
          element.cronograma_nombre,
        );
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
      if (data.Data.macroproceso_id !== undefined) {
        this.reemplazar(this.macroprocesos, data.Data, 'macroproceso_id');
      }
      if (data.Data.vigencia_id !== undefined) {
        this.reemplazar(this.vigencias, data.Data, 'vigencia_id');
      }
      if (data.Data.proceso_id !== undefined) {
        this.reemplazar(this.procesos, data.Data, 'proceso_id');
      }
      if (data.Data.lider_id !== undefined) {
        this.reemplazar(this.lideres, data.Data, 'lider_id');
      }
      if (data.Data.responsable_id !== undefined) {
        this.reemplazar(this.responsables, data.Data, 'responsable_id');
      }
      if (data.Data.dependencia_id !== undefined) {
        data.Data = { ...data.Data, ...this.correos };
        this.reemplazar(this.dependencias, data.Data, 'dependencia_id');
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

  private async asociarAuditores(idAuditor: string) {
    const query = {
      auditoria_id: idAuditor,
      activo: true,
    };
    const queryString = Object.entries(query)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    const queryParam = {
      query: queryString,
      limit: 0,
      fields: '_id,auditor_lider,auditor_id,asignado_por_id',
    };
    let auditoresAuditoria = await this.auditorService.getAll(queryParam);
    return auditoresAuditoria.Data;
  }

  private unirCronogramaNombres(cronograma_nombre: any[]) {
    if (Array.isArray(cronograma_nombre) && cronograma_nombre.length === 12) {
      const mesesCompletos = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const tieneLosMeses = mesesCompletos.every(mes => cronograma_nombre.some(nombre => nombre === mes));
      if (tieneLosMeses) {
        return 'Todos';
      }
    }
    return unirListaNombresConComas(cronograma_nombre);
  }
}
