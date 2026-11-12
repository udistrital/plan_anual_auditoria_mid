import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { ComentarioAccionService } from '../../src/application/comentario-accion/comentario-accion.service';
import { AuditoriaCrudService } from '../../src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from '../../src/shared/services/terceros-helper.service';
import { DominiosService } from '../../src/shared/utils/dominios/dominios.service';

export const ACCION_ID = '672d3050f7814a9a0c5261d4';
export const DEP_LIDER = 14;
export const DEP_APOYO = 22;
export const DEP_AJENA = 99;

export function respuestaCrud(data: any, count?: number) {
  return {
    Success: true,
    Status: 200,
    Message: 'Peticion Exitosa',
    Data: data,
    ...(count !== undefined && { MetaData: { Count: count } }),
  };
}

export function crearComentario(cambios: Record<string, any> = {}) {
  return {
    _id: '672d36737e962bcac5ce9beb',
    accion_mejora_id: ACCION_ID,
    mensaje: 'Pendiente remitir el anexo de firmas de las actas.',
    usuario_id: 101,
    usuario_rol: 'AUDITOR',
    activo: true,
    fecha_creacion: '2026-03-18T10:15:00.000Z',
    fecha_modificacion: '2026-03-18T10:15:00.000Z',
    ...cambios,
  };
}

export function crearResponsables() {
  return [
    {
      _id: 'r1',
      accion_mejora_id: ACCION_ID,
      dependencia_id: DEP_LIDER,
      dependencia_lider: true,
    },
    {
      _id: 'r2',
      accion_mejora_id: ACCION_ID,
      dependencia_id: DEP_APOYO,
      dependencia_lider: false,
    },
  ];
}

export interface OpcionesEscenario {
  accion?: any | null;
  comentarios?: any[];
  count?: number;
  responsables?: any[];
  dependenciasPersona?: number[];
  terceros?: Record<number, string>;
  terceroFalla?: number[];
}

/** Arma el service con el CRUD, Terceros y Oikos simulados según el escenario. */
export async function crearEscenario(opciones: OpcionesEscenario = {}) {
  const accion =
    opciones.accion === undefined
      ? { _id: ACCION_ID, activo: true }
      : opciones.accion;
  const crud = {
    traerDataCrud: jest.fn(async (endpoint: string) => {
      if (endpoint === 'accion-mejora')
        return respuestaCrud(accion ? [accion] : []);
      if (endpoint === 'comentario-accion') {
        const lista = opciones.comentarios ?? [];
        return respuestaCrud(lista, opciones.count ?? lista.length);
      }
      if (endpoint === 'responsable-accion') {
        return respuestaCrud(opciones.responsables ?? crearResponsables());
      }
      throw new Error(`endpoint no simulado: ${endpoint}`);
    }),
    post: jest.fn(async (_endpoint: string, data: any) =>
      respuestaCrud(crearComentario({ ...data, _id: 'nuevo' })),
    ),
  };
  const terceros = {
    getTerceroById: jest.fn(async (id: string) => {
      if (opciones.terceroFalla?.includes(Number(id)))
        throw new Error('Terceros caído');
      const nombre = (opciones.terceros ?? { 101: 'MARIA CAMARGO' })[
        Number(id)
      ];
      return nombre ? { Id: Number(id), NombreCompleto: nombre } : null;
    }),
    getDependenciasByPersona: jest.fn(
      async () => opciones.dependenciasPersona ?? [],
    ),
  };
  const dominios = {
    getDependencias: jest.fn(() =>
      of({
        parametros: [
          { Id: DEP_LIDER, Nombre: 'Oficina de Contratación' },
          { Id: DEP_APOYO, Nombre: 'Oficina Jurídica' },
        ],
      }),
    ),
  };

  const modulo = await Test.createTestingModule({
    providers: [
      ComentarioAccionService,
      { provide: AuditoriaCrudService, useValue: crud },
      { provide: TercerosHelperService, useValue: terceros },
      { provide: DominiosService, useValue: dominios },
    ],
  }).compile();

  return {
    service: modulo.get(ComentarioAccionService),
    crud,
    terceros,
    dominios,
  };
}
