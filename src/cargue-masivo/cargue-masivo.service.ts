import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';

const { PLAN_AUDITORIA_CRUD_SERVICE, TIPO_EVALUACION, MESES } = environment;

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

@Injectable()
export class CargueMasivoService {
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
