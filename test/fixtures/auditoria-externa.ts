import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { AuditoriaCrudService } from '../../src/shared/services/auditoria-crud.service';
import { ParametrosService } from '../../src/shared/services/parametros.service';
import { DominiosService } from '../../src/shared/utils/dominios/dominios.service';
import { AuditoriaExternaRepositorio } from '../../src/application/auditoria-externa/auditoria-externa.repositorio';
import { AuditoriaExternaService } from '../../src/application/auditoria-externa/auditoria-externa.service';

export const AUDITORIA_EXTERNA_ID = '672d4a11f7814a9a0c5261e1';
export const FUENTE_ID = 7158;
export const VIGENCIA_ID = 2025;
export const DEPENDENCIA_ID = 32;

export const respuestaCrud = (data: any, count?: number) => ({
  Success: true,
  Status: 200,
  Message: 'Peticion Exitosa',
  Data: data,
  MetaData: { Count: count ?? (Array.isArray(data) ? data.length : 1) },
});

/** Cuerpo válido del registro; cada prueba sobrescribe solo lo que necesita. */
export const crearCuerpoRegistro = (cambios: Record<string, any> = {}) => ({
  codigo_entidad: 'CB-001',
  nombre_entidad: 'Contraloría de Bogotá',
  nombre_auditoria: 'Auditoría de regularidad PAD 2025',
  fecha_informe_final: '2026-03-10T00:00:00.000Z',
  vigencia_id: VIGENCIA_ID,
  hallazgos: [
    {
      vigencia_pad: VIGENCIA_ID,
      codigo_auditoria_pad: 'PAD-2025-01',
      numeral: '3.1.1.1',
      descripcion: 'Deficiencias en la supervisión de contratos',
      dependencia_id: [DEPENDENCIA_ID],
    },
    {
      vigencia_pad: VIGENCIA_ID,
      codigo_auditoria_pad: 'PAD-2025-01',
      numeral: '3.1.1.2',
      descripcion: 'Falta de soportes en pagos',
      dependencia_id: [DEPENDENCIA_ID, 45],
    },
  ],
  documento: {
    nuxeo_id: 1234,
    nuxeo_enlace: 'https://nuxeo.example/informe.pdf',
  },
  usuario_id: 101,
  usuario_rol: 'AUDITOR',
  ...cambios,
});

export interface OpcionesEscenario {
  /** Endpoint del CRUD que falla al hacer POST. */
  falla?: string;
  /** Auditorías ya registradas del ente (para el 409). */
  existentes?: any[];
  /** Parámetro de fuente (null = no existe). */
  fuente?: number | null;
  /** Datos de la auditoría para las consultas. */
  auditoria?: any | null;
  hallazgos?: any[];
  documentos?: any[];
  plan?: any | null;
  listado?: any[];
}

export const crearAuditoriaGuardada = (cambios: Record<string, any> = {}) => ({
  _id: AUDITORIA_EXTERNA_ID,
  vigencia_id: VIGENCIA_ID,
  codigo_entidad: 'CB-001',
  nombre_entidad: 'Contraloría de Bogotá',
  nombre_auditoria: 'Auditoría de regularidad PAD 2025',
  fecha_informe_final: '2026-03-10T00:00:00.000Z',
  dependencia_id: [DEPENDENCIA_ID, 45],
  estado_id: 0,
  activo: true,
  ...cambios,
});

/** Arma el service con el CRUD, Parámetros y los dominios simulados. */
export async function crearEscenario(opciones: OpcionesEscenario = {}) {
  const auditoria =
    opciones.auditoria === undefined
      ? crearAuditoriaGuardada()
      : opciones.auditoria;
  const crud = {
    traerDataCrud: jest.fn(
      async (
        endpoint: string,
        _id?: string | null,
        consulta?: Record<string, any>,
      ) => {
        const query = String(consulta?.query ?? '');
        switch (endpoint) {
          case 'auditoria-externa':
            // Detalle por _id, verificación de duplicados por código de entidad y listado
            if (query.startsWith('_id:'))
              return respuestaCrud(auditoria ? [auditoria] : []);
            if (query.startsWith('codigo_entidad:'))
              return respuestaCrud(opciones.existentes ?? []);
            return respuestaCrud(opciones.listado ?? []);
          case 'auditoria-externa-hallazgo':
            return respuestaCrud(
              opciones.hallazgos ?? [{ _id: 'h1' }, { _id: 'h2' }],
            );
          case 'documento':
            return respuestaCrud(opciones.documentos ?? []);
          case 'plan-mejoramiento':
            return respuestaCrud(opciones.plan ? [opciones.plan] : []);
          default:
            return respuestaCrud([]);
        }
      },
    ),
    post: jest.fn<Promise<any>, [string, Record<string, any>?]>(
      async (endpoint) => {
        if (opciones.falla === endpoint) throw new Error('CRUD caído');
        return respuestaCrud({ _id: `id-${endpoint}` });
      },
    ),
    delete: jest.fn<Promise<any>, [string, string]>(async () =>
      respuestaCrud({}),
    ),
  };
  const dominios = {
    getParametros: jest.fn(() =>
      of({
        parametros: [
          { Id: 2024, Nombre: '2024' },
          { Id: VIGENCIA_ID, Nombre: '2025' },
        ],
      }),
    ),
    getDependencias: jest.fn(() =>
      of({
        parametros: [
          { Id: DEPENDENCIA_ID, Nombre: 'Oficina de Control Interno' },
          { Id: 45, Nombre: 'Oficina Asesora de Planeación' },
        ],
      }),
    ),
  };
  const parametros = {
    get: jest.fn(async () => ({
      Data:
        opciones.fuente === null ? [] : [{ Id: opciones.fuente ?? FUENTE_ID }],
    })),
  };

  const module = await Test.createTestingModule({
    providers: [
      AuditoriaExternaService,
      AuditoriaExternaRepositorio,
      { provide: AuditoriaCrudService, useValue: crud },
      { provide: DominiosService, useValue: dominios },
      { provide: ParametrosService, useValue: parametros },
    ],
  }).compile();

  return {
    service: module.get(AuditoriaExternaService),
    crud,
    dominios,
    parametros,
  };
}
