import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { FormulacionPlanesService } from './formulacion-planes.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const ESTADO = environment.PLAN_MEJORAMIENTO_ESTADO;

const auditorias = [
  {
    _id: 'a2',
    consecutivo_no_auditoria: 2,
    titulo: 'Contratación',
    dependencia_nombre: ['Oficina de Contratación'],
    vigencia_nombre: '2025',
    tipo_evaluacion_nombre: 'Auditoría Interna',
    auditores: [{ auditor_nombre: 'María Camargo' }],
  },
  {
    _id: 'a1',
    consecutivo_no_auditoria: 1,
    titulo: 'Sistemas',
    dependencia_nombre: ['Oficina de Tecnologías'],
    vigencia_nombre: '2025',
    tipo_evaluacion_nombre: 'Auditoría Interna',
    auditores: [],
  },
  {
    _id: 'a3',
    consecutivo_no_auditoria: 3,
    titulo: 'Admisiones',
    dependencia_nombre: 'Oficina de Admisiones',
    vigencia_nombre: '2025',
    tipo_evaluacion_nombre: 'Auditoría Interna',
    auditores: [],
  },
];

const respuestasCrud: Record<string, any[]> = {
  'plan-mejoramiento': [
    {
      _id: 'p2',
      auditoria_id: 'a2',
      estado_id: ESTADO.CREANDO_PLAN_MEJORAMIENTO,
      fecha_limite: '2025-02-14T10:00:00Z',
    },
    {
      _id: 'p3',
      auditoria_id: 'a3',
      estado_id: ESTADO.RECHAZADO_PLAN_MEJORAMIENTO,
    },
    {
      _id: 'p4',
      auditoria_id: 'a4',
      estado_id: ESTADO.RECHAZADO_PLAN_MEJORAMIENTO,
    },
  ],
  'plan-mejoramiento-auditor': [{ plan_mejoramiento_id: 'p2', auditor_id: 10 }],
  hallazgo: [
    { auditoria_id: 'a1' },
    { auditoria_id: 'a1' },
    { auditoria_id: 'a2' },
  ],
  'plan-mejoramiento-estado': [
    { plan_mejoramiento_id: 'p3' },
    { plan_mejoramiento_id: 'p3' },
  ],
  // a2 tiene dos informes aprobados: se toma el más reciente
  informe: [
    { auditoria_id: 'a1', fecha_aprobacion_informe: '2025-01-31T10:00:00Z' },
    { auditoria_id: 'a2', fecha_aprobacion_informe: '2025-01-20T10:00:00Z' },
    { auditoria_id: 'a2', fecha_aprobacion_informe: '2025-02-03T10:00:00Z' },
  ],
};

/**
 * Respuestas que dependen de la consulta, con clave "endpoint|fragmento de query".
 * Se revisan antes que respuestasCrud.
 */
const respuestasPorConsulta: Record<string, any[]> = {
  // Planes asignados al auditor 10
  'plan-mejoramiento-auditor|auditor_id:10': [{ plan_mejoramiento_id: 'p2' }],
  // Estado actual de cada plan
  'plan-mejoramiento-estado|actual:true': [
    {
      plan_mejoramiento_id: 'p2',
      fecha_ejecucion_estado: '2025-02-12T10:00:00Z',
    },
    {
      plan_mejoramiento_id: 'p4',
      fecha_ejecucion_estado: '2025-02-10T10:00:00Z',
    },
  ],
  'accion-mejora|plan_mejoramiento_id__in': [
    {
      plan_mejoramiento_id: 'p2',
      estado_id: environment.ACCION_MEJORA_ESTADO.APROBADA,
    },
    {
      plan_mejoramiento_id: 'p2',
      estado_id: environment.ACCION_MEJORA_ESTADO.PENDIENTE_REVISION,
    },
    {
      plan_mejoramiento_id: 'p4',
      estado_id: environment.ACCION_MEJORA_ESTADO.RECHAZADA,
    },
  ],
};

/**
 * Auditorías de toda la institución para la vista del auditor (persona 10):
 * a1 la tiene como auditor de la auditoría, a2 como auditor del plan, a4 no le pertenece.
 */
const auditoriasInstitucion = [
  {
    ...auditorias[1],
    auditores: [{ auditor_id: 10, auditor_nombre: 'Carlos Parra' }],
    fecha_inicio: '2025-01-10',
    fecha_fin: '2025-01-30',
  },
  {
    ...auditorias[0],
    auditores: [{ auditor_id: 20, auditor_nombre: 'María Camargo' }],
  },
  {
    _id: 'a4',
    consecutivo_no_auditoria: 4,
    titulo: 'Bienestar',
    dependencia_nombre: 'Bienestar Universitario',
    vigencia_nombre: '2025',
    tipo_evaluacion_nombre: 'Auditoría Interna',
    auditores: [{ auditor_id: 30, auditor_nombre: 'Juan Rojas' }],
  },
];

/** Respuesta del CRUD resumen-plan-mejoramiento (conteos ya calculados en MongoDB). */
const conteosCrud = {
  total_auditorias: 6,
  por_estado: [
    { estado_id: null, cantidad: 2 },
    { estado_id: ESTADO.SIN_PLAN_MEJORAMIENTO, cantidad: 1 },
    { estado_id: ESTADO.CREANDO_PLAN_MEJORAMIENTO, cantidad: 1 },
    { estado_id: ESTADO.RECHAZADO_PLAN_MEJORAMIENTO, cantidad: 1 },
    { estado_id: ESTADO.FIN_PLAN_MEJORAMIENTO, cantidad: 1 },
  ],
};

describe('FormulacionPlanesService', () => {
  let service: FormulacionPlanesService;
  const auditoriaService = { getByDependencia: jest.fn(), getAll: jest.fn() };
  const auditoriaCrudService = {
    traerDataCrud: jest.fn((endpoint: string, _id: any, params: any) => {
      if (endpoint === 'resumen-plan-mejoramiento') {
        return Promise.resolve({ Data: conteosCrud });
      }
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
  const getDependenciasByPersona = jest.fn();
  const query = { vigencia_id: '1', tipo_evaluacion_id: '6770' };

  beforeEach(async () => {
    auditoriaService.getByDependencia.mockResolvedValue({
      Data: auditorias.map((a) => ({ ...a })),
    });
    auditoriaService.getByDependencia.mockClear();
    auditoriaService.getAll.mockResolvedValue({
      Data: auditoriasInstitucion.map((a) => ({ ...a })),
    });
    auditoriaService.getAll.mockClear();
    auditoriaCrudService.traerDataCrud.mockClear();
    getDependenciasByPersona.mockReset().mockResolvedValue([32, 45]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulacionPlanesService,
        { provide: AuditoriaService, useValue: auditoriaService },
        { provide: AuditoriaCrudService, useValue: auditoriaCrudService },
        {
          provide: TercerosHelperService,
          useValue: {
            getDependenciasByPersona,
            getTerceroById: jest
              .fn()
              .mockResolvedValue({ NombreCompleto: 'Pedro Fuentes' }),
          },
        },
        {
          provide: DominiosService,
          useValue: {
            getParametros: () =>
              of({
                parametros: [
                  {
                    Id: ESTADO.CREANDO_PLAN_MEJORAMIENTO,
                    Nombre: 'Creando Plan de Mejoramiento',
                  },
                ],
              }),
          },
        },
      ],
    }).compile();

    service = module.get<FormulacionPlanesService>(FormulacionPlanesService);
  });

  it('agrupa en el resumen los conteos que calcula el CRUD', async () => {
    const { Data } = await service.getResumen(10, 312, query);

    expect(Data).toEqual({
      auditorias_finalizadas: 6,
      sin_formular: 3,
      en_formulacion: 2,
      en_revision: 0,
      aprobados: 1,
    });
  });

  it('el resumen consulta el conteo del CRUD sin armar las filas', async () => {
    await service.getResumen(10, 312, query);

    expect(getDependenciasByPersona).toHaveBeenCalledWith(10, 312);
    expect(auditoriaService.getByDependencia).not.toHaveBeenCalled();
    expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledTimes(1);
    expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledWith(
      'resumen-plan-mejoramiento',
      null,
      {
        vigencia_id: 1,
        tipo_evaluacion_id: 6770,
        dependencia_ids: '32|45',
        estado_auditoria_id:
          environment.AUDITORIA_ESTADO.APROBADO_INFORME_FINAL_JEFE,
      },
    );
  });

  it('el resumen devuelve ceros si el usuario no tiene dependencias', async () => {
    getDependenciasByPersona.mockResolvedValue([]);

    const { Data } = await service.getResumen(10, 312, query);

    expect(Data.auditorias_finalizadas).toBe(0);
    expect(auditoriaCrudService.traerDataCrud).not.toHaveBeenCalled();
  });

  it('arma las filas con hallazgos, rechazos, auditores y orden por número de auditoría', async () => {
    const { Data, MetaData } = await service.getAll(10, 312, query);

    expect(MetaData.Count).toBe(3);
    expect(Data.map((f) => f.no_auditoria)).toEqual(['1', '2', '3']);

    const [sinPlan, creando, rechazado] = Data;
    expect(sinPlan).toMatchObject({
      plan_mejoramiento_id: null,
      estado_plan_id: ESTADO.SIN_PLAN_MEJORAMIENTO,
      estado_plan_nombre: 'Sin Plan de Mejoramiento',
      total_hallazgos: 2,
    });
    expect(creando).toMatchObject({
      auditores_auditoria: ['María Camargo'],
      auditores_plan: ['Pedro Fuentes'],
      dependencia_nombre: 'Oficina de Contratación',
      estado_plan_nombre: 'Creando Plan de Mejoramiento',
      total_hallazgos: 1,
    });
    expect(rechazado).toMatchObject({
      dependencia_nombre: 'Oficina de Admisiones',
      total_observaciones: 2,
    });
  });

  it('cuenta como observaciones solo los rechazos del plan', async () => {
    await service.getAll(10, 312, query);

    const consultaRechazos = auditoriaCrudService.traerDataCrud.mock.calls.find(
      ([endpoint]) => endpoint === 'plan-mejoramiento-estado',
    );
    expect(consultaRechazos?.[2]?.query).toContain(
      `estado_id:${ESTADO.RECHAZADO_PLAN_MEJORAMIENTO}`,
    );
  });

  it('filtra por estados y búsqueda, y pagina', async () => {
    const porEstado = await service.getAll(10, 312, {
      ...query,
      estado_ids: `${ESTADO.CREANDO_PLAN_MEJORAMIENTO},${ESTADO.RECHAZADO_PLAN_MEJORAMIENTO}`,
    });
    expect(porEstado.Data.map((f) => f.auditoria_id)).toEqual(['a2', 'a3']);

    const porBusqueda = await service.getAll(10, 312, {
      ...query,
      busqueda: 'admisiones',
    });
    expect(porBusqueda.Data.map((f) => f.auditoria_id)).toEqual(['a3']);

    const pagina = await service.getAll(10, 312, {
      ...query,
      limit: '1',
      offset: '1',
    });
    expect(pagina.Data.map((f) => f.auditoria_id)).toEqual(['a2']);
    expect(pagina.MetaData.Count).toBe(3);
  });

  it('no consulta nada sin vigencia o tipo de evaluación', async () => {
    const { Data } = await service.getAll(10, 312, {});

    expect(Data).toEqual([]);
    expect(auditoriaService.getByDependencia).not.toHaveBeenCalledWith(
      10,
      312,
      expect.anything(),
    );
  });

  describe('vista del auditor', () => {
    it('el resumen pide al CRUD solo las auditorías asignadas al auditor', async () => {
      const { Data } = await service.getResumenAuditor(10, query);

      expect(Data).toEqual({
        total_auditorias: 6,
        // null (sin plan) se suma a sin_formular
        sin_formular: 3,
        en_formulacion: 1,
        en_revision: 0,
        con_observaciones: 1,
        aprobados: 1,
      });
      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledTimes(1);
      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledWith(
        'resumen-plan-mejoramiento',
        null,
        {
          vigencia_id: 1,
          tipo_evaluacion_id: 6770,
          estado_auditoria_id:
            environment.AUDITORIA_ESTADO.APROBADO_INFORME_FINAL_JEFE,
          auditor_id: 10,
        },
      );
      expect(auditoriaService.getAll).not.toHaveBeenCalled();
    });

    it('con alcance "todas" el resumen no filtra por auditor', async () => {
      await service.getResumenAuditor(10, { ...query, alcance: 'todas' });

      const [, , params] = auditoriaCrudService.traerDataCrud.mock.calls[0];
      expect(params).not.toHaveProperty('auditor_id');
      expect(params).not.toHaveProperty('dependencia_ids');
    });

    it('marca como asignadas las auditorías del auditor de la auditoría o del plan', async () => {
      const { Data, MetaData } = await service.getAllAuditor(10, {
        ...query,
        alcance: 'todas',
      });

      expect(MetaData.Count).toBe(3);
      expect(Data.map((f) => [f.auditoria_id, f.asignada])).toEqual([
        ['a1', true],
        ['a2', true],
        ['a4', false],
      ]);
    });

    it('agrega fechas, plazo de formulación, fecha del estado actual y avance de acciones', async () => {
      const { Data } = await service.getAllAuditor(10, query);
      const [sinPlan, creando] = Data;

      expect(sinPlan).toMatchObject({
        fecha_inicio: '2025-01-10',
        fecha_fin: '2025-01-30',
        fecha_aprobacion_informe: '2025-01-31T10:00:00Z',
        fecha_limite: null,
        fecha_estado: null,
        total_acciones: 0,
        acciones_aprobadas: 0,
      });
      expect(creando).toMatchObject({
        plan_mejoramiento_id: 'p2',
        fecha_aprobacion_informe: '2025-02-03T10:00:00Z',
        fecha_limite: '2025-02-14T10:00:00Z',
        fecha_estado: '2025-02-12T10:00:00Z',
        total_acciones: 2,
        acciones_aprobadas: 1,
      });

      const consultaInformes =
        auditoriaCrudService.traerDataCrud.mock.calls.find(
          ([endpoint]) => endpoint === 'informe',
        );
      expect(consultaInformes?.[2]?.query).toContain(
        'fecha_aprobacion_informe__isnull:false',
      );
    });

    it('filtra por estado y pagina antes de consultar auditores y conteos', async () => {
      const { Data, MetaData } = await service.getAllAuditor(10, {
        ...query,
        alcance: 'todas',
        estado_ids: String(ESTADO.RECHAZADO_PLAN_MEJORAMIENTO),
      });

      expect(MetaData.Count).toBe(1);
      expect(Data).toHaveLength(1);
      expect(Data[0]).toMatchObject({ auditoria_id: 'a4', asignada: false });

      const consultaHallazgos =
        auditoriaCrudService.traerDataCrud.mock.calls.find(
          ([endpoint]) => endpoint === 'hallazgo',
        );
      expect(consultaHallazgos?.[2]?.query).toContain('auditoria_id__in:a4,');
      expect(consultaHallazgos?.[2]?.query).toContain('rechazado__not:true');
    });

    it('no consulta nada sin vigencia o tipo de evaluación', async () => {
      const { Data } = await service.getResumenAuditor(10, {});

      expect(Data.total_auditorias).toBe(0);
      expect(auditoriaCrudService.traerDataCrud).not.toHaveBeenCalled();
    });
  });
});
