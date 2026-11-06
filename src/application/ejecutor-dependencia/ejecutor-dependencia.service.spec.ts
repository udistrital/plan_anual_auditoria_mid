import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { EjecutorDependenciaService } from './ejecutor-dependencia.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const { TIPO_PARAMETRO } = environment;

/** Asignaciones vigentes de ejecutor_dependencia (dos ejecutores en la dependencia 32). */
const ejecutorDependencia = [
  {
    _id: 'ed1',
    dependencia_id: 32,
    usuario_id: 10,
    actual: true,
    activo: true,
    fecha_asignacion: '2026-03-01T10:00:00Z',
  },
  {
    _id: 'ed2',
    dependencia_id: 32,
    usuario_id: 20,
    actual: true,
    activo: true,
    fecha_asignacion: '2026-03-05T10:00:00Z',
  },
  {
    _id: 'ed3',
    dependencia_id: 45,
    usuario_id: 30,
    actual: true,
    activo: true,
    fecha_asignacion: '2026-04-01T10:00:00Z',
  },
];

/** Respuestas fijas del CRUD por endpoint (cuando no dependen de la query). */
const respuestasCrud: Record<string, any[]> = {
  'ejecutor-dependencia': ejecutorDependencia,
  'auditoria-padre': [{ _id: 'ap1' }, { _id: 'ap2' }],
  auditoria: [{ _id: 'a1' }, { _id: 'a2' }],
  'plan-mejoramiento': [
    {
      _id: 'p1',
      auditoria_id: 'a1',
      vigencia_id: 2026,
      fecha_apertura: '2026-05-01T10:00:00Z',
      fecha_limite: '2026-05-20T10:00:00Z',
      estado_id: 7,
    },
    {
      _id: 'p2',
      auditoria_id: 'a2',
      vigencia_id: 2026,
      fecha_apertura: '2026-05-02T10:00:00Z',
      fecha_limite: '2026-05-21T10:00:00Z',
      estado_id: 8,
    },
  ],
  'ejecutor-plan': [{ plan_mejoramiento_id: 'p1' }],
};

/**
 * Respuestas que dependen de la query, con clave "endpoint|fragmento".
 * Se revisan antes que respuestasCrud.
 */
const respuestasPorConsulta: Record<string, any[]> = {
  // Asignaciones del usuario 10 (para getPlanesPorEjecutor)
  'ejecutor-dependencia|usuario_id:10': [
    { _id: 'ed1', dependencia_id: 32, usuario_id: 10 },
  ],
  // Usuario sin asignaciones
  'ejecutor-dependencia|usuario_id:99': [],
  // Resolver usuario_id a partir de ejecutor_dependencia._id (ejecutores por plan)
  'ejecutor-dependencia|_id__in:ed1': [{ _id: 'ed1', usuario_id: 10 }],
  // getPlanesPorEjecutor pide los planes por _id__in (solo p1 según la puente)
  'plan-mejoramiento|_id__in:p1': [
    {
      _id: 'p1',
      auditoria_id: 'a1',
      vigencia_id: 2026,
      fecha_apertura: '2026-05-01T10:00:00Z',
      fecha_limite: '2026-05-20T10:00:00Z',
      estado_id: 7,
    },
  ],
  // ejecutor-plan filtrado por planes (getPlanesPorDependencia): p1 -> ejecutor ed1
  'ejecutor-plan|plan_mejoramiento_id__in': [
    {
      _id: 'ep1',
      plan_mejoramiento_id: 'p1',
      ejecutor_dependencia_id: 'ed1',
    },
  ],
  // ejecutor-plan filtrado por ejecutor_dependencia (getPlanesPorEjecutor)
  'ejecutor-plan|ejecutor_dependencia_id__in': [
    { _id: 'ep1', plan_mejoramiento_id: 'p1' },
  ],
};

const dependenciasOikos = [
  { Id: 32, Nombre: 'Oficina de Contratación' },
  { Id: 45, Nombre: 'Oficina de Tecnologías' },
];

describe('EjecutorDependenciaService (mid)', () => {
  let service: EjecutorDependenciaService;

  const crud = {
    traerDataCrud: jest.fn((endpoint: string, _id: any, params: any) => {
      const consulta = String(params?.query ?? '');
      const clave = Object.keys(respuestasPorConsulta).find(
        (k) =>
          k.startsWith(`${endpoint}|`) && consulta.includes(k.split('|')[1]),
      );
      return Promise.resolve({
        Data: clave
          ? respuestasPorConsulta[clave]
          : (respuestasCrud[endpoint] ?? []),
      });
    }),
  };

  const getTerceroById = jest.fn((id: string) =>
    Promise.resolve({ NombreCompleto: `Persona ${id}` }),
  );

  // Catálogos de dominios: dependencias (OIKOS) y parámetros (vigencia / estado)
  // resueltos por TipoParametroId a través de DominiosService.
  const dominiosService = {
    getDependencias: jest.fn(() => of({ parametros: dependenciasOikos })),
    getParametros: jest.fn((tipoParametroId: number) => {
      if (tipoParametroId === TIPO_PARAMETRO.VIGENCIA) {
        return of({ parametros: [{ Id: 2026, Nombre: '2026' }] });
      }
      if (tipoParametroId === TIPO_PARAMETRO.AUDITORIA_ESTADO) {
        return of({
          parametros: [
            { Id: 7, Nombre: 'Creando Plan de Mejoramiento' },
            { Id: 8, Nombre: 'Aprobado Plan de Mejoramiento' },
          ],
        });
      }
      return of({ parametros: [] });
    }),
  };

  beforeEach(async () => {
    crud.traerDataCrud.mockClear();
    getTerceroById.mockClear();
    dominiosService.getDependencias.mockClear();
    dominiosService.getParametros.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EjecutorDependenciaService,
        { provide: AuditoriaCrudService, useValue: crud },
        { provide: TercerosHelperService, useValue: { getTerceroById } },
        { provide: DominiosService, useValue: dominiosService },
      ],
    }).compile();

    service = module.get<EjecutorDependenciaService>(
      EjecutorDependenciaService,
    );
  });

  describe('getEjecutores', () => {
    it('agrupa por dependencia y resuelve nombres de dependencia y usuario', async () => {
      const { Data, MetaData } = await service.getEjecutores({});

      expect(MetaData.Count).toBe(2);
      expect(Data.map((f) => f.dependencia_id)).toEqual([32, 45]);

      const dep32 = Data.find((f) => f.dependencia_id === 32);
      expect(dep32.dependencia_nombre).toBe('Oficina de Contratación');
      expect(dep32.ejecutores).toHaveLength(2);
      expect(dep32.ejecutores.map((e) => e.usuario_nombre)).toEqual([
        'Persona 10',
        'Persona 20',
      ]);
      expect(dep32.ejecutores[0]).toMatchObject({
        _id: 'ed1',
        usuario_id: 10,
        fecha_asignacion: '2026-03-01T10:00:00Z',
      });
    });

    it('consulta el CRUD solo por asignaciones vigentes', async () => {
      await service.getEjecutores({});

      const llamada = crud.traerDataCrud.mock.calls.find(
        ([endpoint]) => endpoint === 'ejecutor-dependencia',
      );
      expect(llamada?.[2]?.query).toContain('actual:true');
      expect(llamada?.[2]?.query).toContain('activo:true');
    });

    it('filtra por búsqueda sobre el nombre de la dependencia', async () => {
      const { Data, MetaData } = await service.getEjecutores({
        busqueda: 'tecnolog',
      });

      expect(MetaData.Count).toBe(1);
      expect(Data[0].dependencia_id).toBe(45);
    });

    it('pagina las dependencias', async () => {
      const { Data, MetaData } = await service.getEjecutores({
        limit: '1',
        offset: '1',
      });

      expect(MetaData.Count).toBe(2);
      expect(Data).toHaveLength(1);
      expect(Data[0].dependencia_id).toBe(45);
    });

    it('usa placeholder si OIKOS no trae la dependencia', async () => {
      dominiosService.getDependencias.mockReturnValueOnce(
        of({ parametros: [] }),
      );

      const { Data } = await service.getEjecutores({});
      expect(Data[0].dependencia_nombre).toBe('Dependencia 32');
    });
  });

  describe('getPlanesPorDependencia', () => {
    it('resuelve la cadena auditoria_padre -> auditoria -> plan_mejoramiento', async () => {
      const { Data, MetaData } = await service.getPlanesPorDependencia(32);

      expect(MetaData.Count).toBe(2);
      expect(Data.map((p) => p.plan_mejoramiento_id)).toEqual(['p1', 'p2']);
      expect(Data[0]).toMatchObject({
        plan_mejoramiento_id: 'p1',
        auditoria_id: 'a1',
        estado_id: 7,
      });

      // Verifica que la primera consulta filtra por la dependencia en el arreglo
      const consultaPadre = crud.traerDataCrud.mock.calls.find(
        ([endpoint]) => endpoint === 'auditoria-padre',
      );
      expect(consultaPadre?.[2]?.query).toContain('dependencia_id__inarray:32');
    });

    it('adjunta a cada plan los ejecutores asignados (tabla puente)', async () => {
      const { Data } = await service.getPlanesPorDependencia(32);

      const p1 = Data.find((p) => p.plan_mejoramiento_id === 'p1');
      const p2 = Data.find((p) => p.plan_mejoramiento_id === 'p2');

      expect(p1.ejecutores).toHaveLength(1);
      expect(p1.ejecutores[0]).toMatchObject({
        ejecutor_plan_id: 'ep1',
        ejecutor_dependencia_id: 'ed1',
        usuario_id: 10,
        usuario_nombre: 'Persona 10',
      });
      // p2 no tiene asignaciones en la puente -> lista vacía
      expect(p2.ejecutores).toEqual([]);
    });

    it('agrega vigencia_nombre y estado_nombre conservando los ids', async () => {
      const { Data } = await service.getPlanesPorDependencia(32);

      // Estándar *_id + *_nombre: el id se conserva.
      expect(Data[0]).toMatchObject({
        vigencia_id: 2026,
        vigencia_nombre: '2026',
        estado_id: 7,
        estado_nombre: 'Creando Plan de Mejoramiento',
      });
      expect(Data[1]).toMatchObject({
        estado_id: 8,
        estado_nombre: 'Aprobado Plan de Mejoramiento',
      });

      // Se consultan ambos dominios: vigencia y estado de auditoría.
      expect(dominiosService.getParametros).toHaveBeenCalledWith(
        TIPO_PARAMETRO.VIGENCIA,
      );
      expect(dominiosService.getParametros).toHaveBeenCalledWith(
        TIPO_PARAMETRO.AUDITORIA_ESTADO,
      );
    });

    it('devuelve vacío si la dependencia no tiene auditorías padre', async () => {
      crud.traerDataCrud.mockImplementationOnce(() =>
        Promise.resolve({ Data: [] }),
      );

      const { Data, MetaData } = await service.getPlanesPorDependencia(99);
      expect(Data).toEqual([]);
      expect(MetaData.Count).toBe(0);
    });
  });

  describe('getPlanesPorEjecutor', () => {
    it('resuelve los planes del usuario vía la tabla puente', async () => {
      const { Data, MetaData } = await service.getPlanesPorEjecutor(10);

      expect(MetaData.Count).toBe(1);
      expect(Data[0].plan_mejoramiento_id).toBe('p1');

      const consultaPuente = crud.traerDataCrud.mock.calls.find(
        ([endpoint]) => endpoint === 'ejecutor-plan',
      );
      expect(consultaPuente?.[2]?.query).toContain(
        'ejecutor_dependencia_id__in:ed1',
      );
      expect(consultaPuente?.[2]?.query).toContain('actual:true');
    });

    it('devuelve vacío si el usuario no es ejecutor de ninguna dependencia', async () => {
      const { Data, MetaData } = await service.getPlanesPorEjecutor(99);

      expect(Data).toEqual([]);
      expect(MetaData.Count).toBe(0);
      // No debe consultar la tabla puente si no hay asignaciones
      const consultaPuente = crud.traerDataCrud.mock.calls.find(
        ([endpoint]) => endpoint === 'ejecutor-plan',
      );
      expect(consultaPuente).toBeUndefined();
    });
  });
});
