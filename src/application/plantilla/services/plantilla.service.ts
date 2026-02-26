import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { jsonPlantillaDto, PlantillaDto } from '../dto/plantilla.dto';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  PLANTILLAS,
  MESES,
  PLANTILLAS_MID_SERVICE,
  PARAMETROS_SERVICE,
  OIKOS_SERVICE,
} = environment;

/** Interface representing a parameter with an ID and a name. */
interface Parametro {
  Id: number;
  Nombre: string;
}

@Injectable()
export class PlantillaService {
  constructor(private readonly httpService: HttpService) {}
  async getOne(id: string, conEspeciales: boolean) {
    let data = await this.traerDataCrud(id);
    if (conEspeciales)
      data = await this.anadirDataEspeciales(data);

    const baseJson = await this.organizarData(data);
    const baseRenderizado = await this.renderizar(baseJson);
    return baseRenderizado;
  }

  private async traerDataCrud(id: string) {
    let urlPlanAuditoria = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${id}`;
    let urlAuditioria = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria?query=plan_auditoria_id:${id},activo:true&fields=titulo,macroproceso_id,proceso_id,dependencia_id,cronograma_id&limit=0`;
    try {
      const responsePlanAuditoria = await lastValueFrom(
        this.httpService.get(urlPlanAuditoria),
      );
      let dataPlanAuditoria = responsePlanAuditoria.data;
      const responseAuditoria = await lastValueFrom(
        this.httpService.get(urlAuditioria),
      );
      let dataAuditoria = responseAuditoria.data;

      return { dataPlanAuditoria, dataAuditoria };
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo ',
        error,
      );
    }
  }

  /**
   * Recover special audit program (same vigencia bur no PAA) data and add it to the main data object.
   * @param data The main data object containing the audit plan and audits.
   * @returns The updated data object with the special audit data included.
   */
  private async anadirDataEspeciales(data: any) {
    const vigenciaId = data.dataPlanAuditoria.Data?.vigencia_id;
    const urlAuditioria = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria?query=vigencia_id:${vigenciaId},plan_auditoria_id__isnull:true,activo:true&fields=titulo,macroproceso_id,proceso_id,dependencia_id,cronograma_id&limit=0`;

    try {
      const responseAuditoriaEspecial = await lastValueFrom(
        this.httpService.get(urlAuditioria),
      );
      let dataAuditoriaEspecial = responseAuditoriaEspecial.data;

      return { ...data, dataAuditoriaEspecial };
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos de auditoría especial del servicio externo ',
        error,
      );
    }
  }

  private async organizarData(data: any) {
    const json = new jsonPlantillaDto();

    const auditorias = data.dataAuditoria?.Data || [];
    const auditoriasOrden = data.dataPlanAuditoria?.Data?.auditorias || [];
    const auditoriasOrdenadas = this.ordenarAuditorias(
      auditorias,
      auditoriasOrden,
    );

    const items: Promise<PlantillaDto[]> = Array.isArray(auditorias)
      ? Promise.all(auditoriasOrdenadas.map((auditoria: any) =>
          this.organizarItems(auditoria),
        ))
      : Promise.resolve([]);

    const auditoriasEspeciales = data.dataAuditoriaEspecial?.Data || [];
    const auditoriasEspecialesOrden = data.dataPlanAuditoria?.Data?.auditorias_especiales || [];
    const auditoriasEspecialesOrdenadas = this.ordenarAuditorias(
      auditoriasEspeciales,
      auditoriasEspecialesOrden,
    );

    const especiales: Promise<PlantillaDto[]> = Array.isArray(auditoriasEspeciales)
      ? Promise.all(auditoriasEspecialesOrdenadas.map((auditoria: any) =>
          this.organizarItems(auditoria),
        ))
      : Promise.resolve([]);

    json.plantilla_id = PLANTILLAS.PLAN_ANUAL_AUDITORIA;
    json.data = {
      codigo: 'EC-PR-005-FR-001',
      proceso: 'Gestión de la Evaluación y el Control',
      objetivo: data.dataPlanAuditoria.Data?.objetivo || '',
      alcance: data.dataPlanAuditoria.Data?.alcance || '',
      criterios: data.dataPlanAuditoria.Data?.criterio || '',
      recursos: data.dataPlanAuditoria.Data?.recurso || '',
      items: await items,
      especiales: await especiales,
    };

    console.debug('JSON generado para renderizar:', JSON.stringify(json, null, 2));
    return json;
  }

  private async organizarItems(data: any): Promise<PlantillaDto> {
    const idMesMap = {
      [MESES.ENERO]: 'enero',
      [MESES.FEBRERO]: 'febrero',
      [MESES.MARZO]: 'marzo',
      [MESES.ABRIL]: 'abril',
      [MESES.MAYO]: 'mayo',
      [MESES.JUNIO]: 'junio',
      [MESES.JULIO]: 'julio',
      [MESES.AGOSTO]: 'agosto',
      [MESES.SEPTIEMBRE]: 'septiembre',
      [MESES.OCTUBRE]: 'octubre',
      [MESES.NOVIEMBRE]: 'noviembre',
      [MESES.DICIEMBRE]: 'diciembre',
    };

    const mesesMarcados = Object.keys(idMesMap).reduce(
      (acc, id) => {
        acc[idMesMap[id]] = '';
        return acc;
      },
      {} as { [key: string]: string },
    );

    (data.cronograma_id || []).forEach((id: number) => {
      const mes = idMesMap[id];
      if (mes) {
        mesesMarcados[mes] = 'marcado';
      } else {
        mesesMarcados[mes] = '';
      }
    });

    const macroproceso = data.macroproceso_id == null
                          ? 'No definido'
                          : await this.getParametroName(data.macroproceso_id)
                              .catch(error => {
                                console.error(
                                  `Error fetching macroproceso name for ID ${data.macroproceso_id}:`, error
                                );
                                return '?error';
                              });

    const proceso = data.proceso_id == null
                    ? 'No definido'
                    : await this.getParametroName(data.proceso_id)
                        .catch(error => {
                          console.error(
                            `Error fetching proceso name for ID ${data.proceso_id}:`, error
                          );
                          return '?error';
                        });

    const dependencia = data.dependencia_id == null
                      ? 'No definido'
                      : await this.getDependenciaName(data.dependencia_id)
                          .catch(error => {
                            console.error(
                              `Error fetching dependencia name for ID ${data.dependencia_id}:`, error
                            );
                            return '?error';
                          });

    return {
      actividad: data.titulo || 'No definido',
      macroproceso: macroproceso,
      proceso: proceso,
      dependencia: dependencia,
      ...mesesMarcados,
    };
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

  private async renderizar(data: jsonPlantillaDto) {
    let urlPlanAuditoria = `${PLANTILLAS_MID_SERVICE}/v1/plantilla/renderizar`;
    try {
      const response = await lastValueFrom(
        this.httpService.post(urlPlanAuditoria, data),
      );
      return response.data;
    } catch (error) {
      console.error('Error al enviar data:', error);
      throw new Error('No se pudo enviar el plan');
    }
  }

  /**
   * Obtains a parametro's name given its id by fetching data from the PARAMETROS_SERVICE.
   * @param parametroId The ID of the parameter fetch.
   * @returns A promise that resolves to the name of the parameter corresponding to the given ID.
   * @throws An error if the fetch operation fails or if the response is not in the expected format.
   */
  // TODO: Modularize using either DominioService or ParametrosService
  private async getParametroName(parametroId: number): Promise<string> {
    const url = `${PARAMETROS_SERVICE}parametro?query=Activo:true,Id:${parametroId}&fields=Id,Nombre&limit=0`;
    console.debug(`Fetching [${parametroId}] type parameters from URL: ${url}`);
    try {
      const name = await this.fetchParametroName(url);
      console.debug(`Fetched parameter name: ${name}`);
      return name;
    }
    catch (error) {
      const newError = new Error('Failed to get parametro');
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }

  /**
   * Obtains a dependency's name given its id by fetching data from the OIKOS_SERVICE.
   * @returns A promise that resolves to the name of the dependency corresponding to the given ID.
   * @throws An error if the fetch operation fails or if the response is not in the expected format.
   */
  // TODO: Modularize using either DominioService or ParametrosService
  private async getDependenciaName(dependenciaId: number): Promise<string> {
    const url = `${OIKOS_SERVICE}dependencia?query=Activo:true,Id:${dependenciaId}&fields=Id,Nombre&limit=0`;
    console.debug(`Fetching dependencia name from URL: ${url}`);
    try {
      const name = await this.fetchParametroName(url);
      console.debug(`Fetched dependencia name: ${name}`);
      return name;
    }
    catch (error) {
      const newError = new Error('Failed to get dependencias');
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }

  /**
   * Fetches parameters from a given URL and returns a mapping of parameter names to their corresponding IDs.
   * @param url The URL to fetch the parameters from.
   * @returns A promise that resolves to a mapping of parameter names to IDs.
   * @throws An error if the fetch operation fails or if the response is not in the expected format (See {@link Parametro}).
   */
  // TODO: Modularize using either DominioService or ParametrosService
  private async fetchParametroName(url: string): Promise<string> {
    try {
      // Fetch the parameters from the given URL
      console.debug(`Fetching parameters from URL: ${url}`);
      const response = await lastValueFrom(this.httpService.get(url));
      const axiosData = response.data;
      const data: Parametro[] = axiosData.Data || axiosData;

      // Validate the response format
      if (!Array.isArray(data))
        throw new Error('Invalid response format: expected an array');
      
      if (!data.every(item => 'Id' in item && 'Nombre' in item))
        throw new Error('Invalid response format: expected objects with Id and Nombre properties');

      // Validate that we have at least one parameter in the response
      if (data.length === 0)
        throw new Error('No parameters found in the response');

      // Assume the first parameter in the response is the one we want (since we query by ID, there should be at most one)
      const parametroName = data[0].Nombre;
      return parametroName;
    }
    catch (error) {
      const newError = new Error(`Failed to fetch parameters from ${url}`);
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }
}
