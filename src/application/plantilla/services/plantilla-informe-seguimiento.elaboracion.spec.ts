import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { PlantillaInformeSeguimientoService } from './plantilla-informe-seguimiento.service';

// La plantilla V2 del informe de seguimiento reemplaza la tabla "Auditor Responsable" por "Proyectó / Aprobó",
// que se arma con `elaboracion`. Seguimiento solo tiene informe final, así que la tabla va siempre.
describe('PlantillaInformeSeguimientoService - tabla Proyectó / Aprobó', () => {
  let service: PlantillaInformeSeguimientoService;
  let auditoresCrud: any[];
  const plantillasMidMock = {
    post: jest.fn(() => Promise.resolve({ Data: 'pdf-base64' })),
  };
  const tercerosMock = {
    getJefeOCI: jest.fn(() => Promise.resolve('JEFE OCI')),
    getTerceroVinculado: jest.fn(() => Promise.resolve(null)),
    getTerceroById: jest.fn((id: string) => {
      const nombres: Record<string, string> = {
        '1': 'AUDITOR UNO',
        '2': 'AUDITOR LIDER',
        '3': 'AUDITOR TRES',
      };
      if (id === 'falla') return Promise.reject(new Error('Terceros caído'));
      return Promise.resolve(
        nombres[id] ? { NombreCompleto: nombres[id] } : null,
      );
    }),
  };
  const crudMock = {
    traerDataCrud: jest.fn((endpoint: string) => {
      const respuestas: Record<string, any[]> = {
        informe: [
          { _id: 'informe-1', fecha_emision: '2026-11-16T00:00:00.000Z' },
        ],
        tema: [],
        'auditoria-estado': [],
        auditor: auditoresCrud,
      };
      return Promise.resolve({ Data: respuestas[endpoint] ?? [] });
    }),
  };

  const cuerpoEnviado = () =>
    ((plantillasMidMock.post as jest.Mock).mock.calls[0] as any[])[1].data;

  beforeEach(async () => {
    auditoresCrud = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantillaInformeSeguimientoService,
        { provide: PlantillasMidService, useValue: plantillasMidMock },
        { provide: AuditoriaCrudService, useValue: crudMock },
        {
          provide: AuditoriaService,
          useValue: {
            getOne: jest.fn(() =>
              Promise.resolve({
                Data: {
                  _id: 'auditoria-1',
                  titulo: 'Seguimiento',
                  tipo_evaluacion_id: 0,
                  dependencia_id: [],
                },
              }),
            ),
          },
        },
        { provide: TercerosHelperService, useValue: tercerosMock },
        { provide: OikosService, useValue: { traerData: jest.fn() } },
        { provide: NuxeoService, useValue: { obtenerPorUUID: jest.fn() } },
      ],
    }).compile();

    service = module.get(PlantillaInformeSeguimientoService);
  });

  afterEach(() => jest.clearAllMocks());

  it('envía los auditores con el líder primero y al Jefe OCI como quien aprueba', async () => {
    auditoresCrud = [
      { auditor_id: '1', auditor_lider: false },
      { auditor_id: '2', auditor_lider: true },
      { auditor_id: '3', auditor_lider: false },
    ];

    await service.get('auditoria-1');

    const data = cuerpoEnviado();
    expect(data.elaboracion).toEqual({
      proyecto: [
        { nombre: 'AUDITOR LIDER', cargo: 'Auditor líder' },
        { nombre: 'AUDITOR UNO', cargo: 'Auditor' },
        { nombre: 'AUDITOR TRES', cargo: 'Auditor' },
      ],
      aprobo: { nombre: 'JEFE OCI', cargo: 'Jefe Oficina de Control Interno' },
    });
    expect(data.es_preliminar).toBe(false);
    expect(data.auditor_responsable).toBe('AUDITOR LIDER');
  });

  it('sin auditores asignados deja una fila "Sin auditor asignado." para que la tabla no quede vacía', async () => {
    await service.get('auditoria-1');

    const data = cuerpoEnviado();
    expect(data.elaboracion.proyecto).toEqual([
      { nombre: 'Sin auditor asignado.', cargo: 'Auditor' },
    ]);
    expect(data.auditor_responsable).toBe('Sin auditor asignado.');
  });

  it('omite los auditores que no están en Terceros o cuya consulta falla, sin dejar de generar el informe', async () => {
    auditoresCrud = [
      { auditor_id: 'falla', auditor_lider: true },
      { auditor_id: 'no-existe', auditor_lider: false },
      { auditor_lider: false },
      { auditor_id: '3', auditor_lider: false },
    ];

    await service.get('auditoria-1');

    expect(cuerpoEnviado().elaboracion.proyecto).toEqual([
      { nombre: 'AUDITOR TRES', cargo: 'Auditor' },
    ]);
  });

  it('si no encuentra al Jefe OCI deja el texto de respaldo en la firma y en "Aprobó"', async () => {
    tercerosMock.getJefeOCI.mockResolvedValueOnce('');

    await service.get('auditoria-1');

    const data = cuerpoEnviado();
    const respaldo =
      'No se encontró el jefe de la Oficina Asesora de Control Interno';
    expect(data.jefe_oci).toBe(respaldo);
    expect(data.elaboracion.aprobo.nombre).toBe(respaldo);
  });
});
