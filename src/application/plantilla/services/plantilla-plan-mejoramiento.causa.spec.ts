import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { ParametrosService } from 'src/shared/services/parametros.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { PlantillaPlanMejoramientoService } from './plantilla-plan-mejoramiento.service';
import {
  crearAccionPlan,
  crearHallazgoPlan,
  respuestaCrud,
} from '../../../../test/fixtures/plantilla';

describe('PlantillaPlanMejoramientoService - causa de la acción (#947)', () => {
  let service: PlantillaPlanMejoramientoService;
  const auditoriaCrudServiceMock = { traerDataCrud: jest.fn() };
  const oikosServiceMock = {
    traerData: jest.fn().mockResolvedValue({ Nombre: 'Dependencia' }),
  };

  const obtenerFilas = (auditoriaId: string, planId?: string) =>
    service['obtenerFilasAcciones'](auditoriaId, planId);

  /** Responde a cada consulta del CRUD según el endpoint */
  const responderCrud = (datos: Record<string, any[]>) =>
    auditoriaCrudServiceMock.traerDataCrud.mockImplementation(
      async (endpoint: string) => respuestaCrud(datos[endpoint] ?? []),
    );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantillaPlanMejoramientoService,
        { provide: PlantillasMidService, useValue: {} },
        { provide: AuditoriaCrudService, useValue: auditoriaCrudServiceMock },
        { provide: AuditoriaService, useValue: {} },
        { provide: ParametrosService, useValue: {} },
        { provide: OikosService, useValue: oikosServiceMock },
        { provide: 'MOMENT', useValue: moment },
      ],
    }).compile();

    service = module.get<PlantillaPlanMejoramientoService>(
      PlantillaPlanMejoramientoService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('toma la causa de cada acción y no el criterio del hallazgo', async () => {
    responderCrud({
      hallazgo: [crearHallazgoPlan()],
      'accion-mejora': [
        crearAccionPlan({ _id: 'accion-1', causa: 'Causa de la acción 1' }),
        crearAccionPlan({ _id: 'accion-2', causa: 'Causa de la acción 2' }),
      ],
    });

    const filas = await obtenerFilas('auditoria-1', 'plan-1');

    expect(filas.map((f) => f.causa)).toEqual([
      'Causa de la acción 1',
      'Causa de la acción 2',
    ]);
    expect(filas.every((f) => f.causa !== 'Criterio evaluado en fase 3')).toBe(
      true,
    );
  });

  it('deja la causa en blanco en acciones anteriores que no la tienen', async () => {
    responderCrud({
      hallazgo: [crearHallazgoPlan()],
      'accion-mejora': [crearAccionPlan({ causa: undefined })],
    });

    const [fila] = await obtenerFilas('auditoria-1', 'plan-1');

    expect(fila.causa).toBe('');
    expect(fila.descripcion).toBe('Inconsistencias en registros contables');
  });
});
