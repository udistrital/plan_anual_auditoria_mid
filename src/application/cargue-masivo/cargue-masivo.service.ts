import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { firstValueFrom } from 'rxjs';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { setupValidationDomains, descargarAuditorias, AuditoriaExcel } from 'src/shared/utils/auditoriasExcel.utils';
import {
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from 'src/shared/utils/base64.utils';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  TIPO_EVALUACION,
  MESES,
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
  constructor(
    private readonly dominiosService: DominiosService,
  ) {}

  /**
   * Add validation domains and formulaes to the template before downloading it,
   * including 'Tipo de Evaluación', 'Macroproceso', 'Proceso' and 'Dependencia'.
   * @param plantillaBase64 The original template in Base64 format.
   * @return A promise that resolves with the modified template in Base64 format, including the added validation domains and formulas.
   * @throws An error if the process of adding validations fails, with a message indicating the failure and the original error stack trace.
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
   * Exports the given data source to an Excel file using the provided template, and adds validation domains to the resulting file.
   * @param dataSource An array of AuditoriaExcel objects representing the data to be exported.
   * @param plantillaBase64 The template to be used for exporting, in Base64 format.
   * @returns A promise that resolves with the exported Excel file in Base64 format.
   * @throws An error if the export process fails, with a message indicating the failure and the original error stack trace.
   */
  async exportarAuditoriasExcel(
    dataSource: Array<AuditoriaExcel>,
    plantillaBase64: string
  ): Promise<string> {
    try {
      const tablaExportadaBuffer = await descargarAuditorias(
          dataSource,
          base64ToArrayBuffer(plantillaBase64)
        );
      const tablaConValidacionBuffer = await setupValidationDomains(
        await this.prepararHeadersValidacion(),
        [ { sheetIndex: 0 , length: dataSource.length + 1 } ],
        tablaExportadaBuffer,
      );
      return arrayBufferToBase64(tablaConValidacionBuffer);
    }
    catch (error) {
      const newError = new Error('Failed to export auditorias to Excel');
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
      const parametros = (await firstValueFrom(this.dominiosService.getParametros(tipo.id))).parametros;
      opciones[tipo.nombre] = parametros.map(p => p.Nombre);
    }
    opciones['Dependencia'] = (await firstValueFrom(this.dominiosService.getDependencias())).parametros.map(d => d.Nombre);

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

}
