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
    },
    {
      _id: 'p3',
      auditoria_id: 'a3',
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
};

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
  const auditoriaService = { getByDependencia: jest.fn() };
  const auditoriaCrudService = {
    traerDataCrud: jest.fn((endpoint: string) =>
      Promise.resolve({
        Data:
          endpoint === 'resumen-plan-mejoramiento'
            ? conteosCrud
            : (respuestasCrud[endpoint] ?? []),
      }),
    ),
  };
  const getDependenciasByPersona = jest.fn();
  const query = { vigencia_id: '1', tipo_evaluacion_id: '6770' };

  beforeEach(async () => {
    auditoriaService.getByDependencia.mockResolvedValue({
      Data: auditorias.map((a) => ({ ...a })),
    });
    auditoriaService.getByDependencia.mockClear();
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
    expect(consultaRechazos?.[2].query).toContain(
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
});
