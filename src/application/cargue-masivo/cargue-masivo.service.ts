import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { setupValidationDomains } from 'src/shared/utils/auditoriasExcel.utils';
import {
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from 'src/shared/utils/base64.utils';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  TIPO_EVALUACION,
  MESES,
  PARAMETROS_SERVICE,
  OIKOS_SERVICE,
} = environment;

const MESES_MAPPING = {
  Ene: MESES.ENERO,
  Feb: MESES.FEBRERO,
  Mar: MESES.MARZO,
  Abr: MESES.ABRIL,
  May: MESES.MAYO,
  Jun: MESES.JUNIO,
  Jul: MESES.JULIO,
  Ago: MESES.AGOSTO,
  Sep: MESES.SEPTIEMBRE,
  Oct: MESES.OCTUBRE,
  Nov: MESES.NOVIEMBRE,
  Dic: MESES.DICIEMBRE,
};

const TIPO_EVALUACION_MAPPING = {
  'Auditoria Interna': TIPO_EVALUACION.AUDITORIA_INTERNA,
  Seguimiento: TIPO_EVALUACION.SEGUIMIENTO,
  Informe: TIPO_EVALUACION.INFORME,
};

const MEDIO_MAPPING = {
  Fisico: TIPO_EVALUACION.AUDITORIA_INTERNA,
  Digital: TIPO_EVALUACION.SEGUIMIENTO,
  Otro: TIPO_EVALUACION.INFORME,
};

/** Interface representing a parameter object with an Id and Nombre property. */
interface Parametro {
  Id: number;
  Nombre: string;
}

@Injectable()
export class CargueMasivoService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Add validation domains and formulaes to the template before downloading it,
   * including 'Tipo de Evaluación', 'Macroproceso', 'Proceso' and 'Dependencia'.
   * @param plantillaBase64 The original template in Base64 format.
   */
  async agregarValidaciones(plantillaBase64: string): Promise<string> {
    try {
      const validationDomains = await this.prepararHeadersValidacion();
      const plantillaArrayBuffer = base64ToArrayBuffer(plantillaBase64);
      const plantillaConValidacionesArrayBuffer = await setupValidationDomains(
        validationDomains,
        [ { sheetIndex: 0 }, { sheetIndex: 1 } ],
        plantillaArrayBuffer,
      );
      const plantillaConValidacionesBase64 = arrayBufferToBase64(plantillaConValidacionesArrayBuffer);
      return plantillaConValidacionesBase64;
    }
    catch (error) {
      const newError = new Error('Failed to add validations to the template');
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }

  /**
   * Prepares the validation domains for the Excel file by loading the necessary options from the Parametros API and Oikos API.
   * @returns A promise that resolves with an object mapping Excel headers to their corresponding validation options.
   */
  async prepararHeadersValidacion(): Promise<{ [key: string]: string[] }> {
    // Types of parameters to load from the Parametros API.
    const tiposDeParametros = [
      { nombre: 'Tipo de Evaluación', id: environment.TIPO_PARAMETRO.TIPO_EVALUACION },
      { nombre: 'Macroproceso', id: environment.TIPO_PARAMETRO.MACROPROCESO },
      { nombre: 'Proceso', id: environment.TIPO_PARAMETRO.PROCESO },
    ]

    // Load options for each parameter type and for Depenendencias.
    let opciones: { [key: string]: string[] } = {};
    for (const tipo of tiposDeParametros) {
      const parametros = await this.getParametros(tipo.id);
      opciones[tipo.nombre] = parametros.map(p => p.Nombre);
    }
    opciones['Dependencia'] = (await this.getDependencias()).map(d => d.Nombre);

    return opciones;
  }

  crearEstructura(base64data: string, complemento: Object): any {
    return {
      base64data,
      service: PLAN_AUDITORIA_CRUD_SERVICE,
      endpoint: 'auditoria-gestion',
      complement: complemento,
      structure: {
        titulo: { file_name_column: 'Auditoría', required: true },
        tipo_evaluacion_id: {
          file_name_column: 'Tipo de Evaluación',
          required: true,
          mapping: TIPO_EVALUACION_MAPPING,
        },
        cronograma_id: {
          column_group: Object.keys(MESES_MAPPING),
          mapping: MESES_MAPPING,
        },
      },
    };
  }

  crearEstructuraActividad(base64data: string, complemento: Object): any {
    return {
      base64data,
      service: environment.PLAN_AUDITORIA_CRUD_SERVICE,
      endpoint: 'actividad',
      complement: complemento,
      structure: {
        titulo: { file_name_column: 'Titulo', required: true },
        fecha_inicio: { file_name_column: 'Fecha Inicio', required: false },
        fecha_fin: { file_name_column: 'Fecha Fin', required: false },
        referencia: { file_name_column: 'Referencia', required: false },
        descripcion: { file_name_column: 'Descripcion', required: false },
        folio: { file_name_column: 'Folio', required: false },
        Medio_id: {
          file_name_column: 'Medio',
          required: false,
          mapping: MEDIO_MAPPING,
        },
        carpeta: { file_name_column: 'Carpeta', required: false },
      },
    };
  }

  /**
   * Obtains parameters of a specific type by fetching data from the PARAMETROS_SERVICE.
   * @param tipoParametroId The ID of the parameter type to fetch.
   * @returns A promise that resolves to an array of parameter objects corresponding to the specified type.
   * @throws An error if the fetch operation fails or if the response is not in the expected format (See {@link Parametro}).
   */
  private async getParametros(tipoParametroId: number): Promise<Parametro[]> {
    const url = `${PARAMETROS_SERVICE}parametro?query=Activo:true,TipoParametroId:${tipoParametroId}&fields=Id,Nombre&limit=0`;
    console.debug(`Fetching [${tipoParametroId}] type parameters from URL: ${url}`);
    try {
      return this.fetchParametros(url);
    }
    catch (error) {
      const newError = new Error('Failed to get parametros');
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }

  /**
   * Obtains the list of dependencies by fetching data from the OIKOS_SERVICE.
   * @returns A promise that resolves to an array of dependency objects.
   * @throws An error if the fetch operation fails or if the response is not in the expected format (See {@link Parametro}).
   */
  private async getDependencias(): Promise<Parametro[]> {
    const url = `${OIKOS_SERVICE}dependencia?query=Activo:true&fields=Id,Nombre&limit=0`;
    console.debug(`Fetching dependencies from URL: ${url}`);
    try {
      return await this.fetchParametros(url);
    }
    catch (error) {
      const newError = new Error('Failed to get dependencias');
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }

  /**
   * Fetches parameters from a given URL.
   * @param url The URL to fetch the parameters from.
   * @returns A promise that resolves to an array of parameter objects.
   * @throws An error if the fetch operation fails or if the response is not in the expected format (See {@link Parametro}).
   */
  private async fetchParametros(url: string): Promise<Parametro[]> {
    try {
      // Fetch the parameters from the given URL
      console.debug(`Fetching parameters from URL: ${url}`);
      const response = await firstValueFrom(this.httpService.get(url));
      const axiosData = response.data;
      const data: Parametro[] = axiosData.Data || axiosData;

      // Validate the response format
      if (!Array.isArray(data))
        throw new Error('Invalid response format: expected an array');
      
      if (!data.every(item => 'Id' in item && 'Nombre' in item))
        throw new Error('Invalid response format: expected objects with Id and Nombre properties');

      return data;
    }
    catch (error) {
      const newError = new Error(`Failed to fetch parameters from ${url}`);
      newError.stack += "\nCaused by: " + error.stack;
      throw newError;
    }
  }

}
