import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { PlantillaInformeSeguimientoService } from './plantilla-informe-seguimiento.service';
import {
  contenidoNuxeoBase64,
  crearTema,
  enlaceNuxeo,
  htmlConImagen,
} from '../../../../test/fixtures/plantilla';

// Antes de #940 el informe de seguimiento enviaba a la plantilla el texto "NuxeoEnlace:<uuid>" en vez del HTML.
describe('PlantillaInformeSeguimientoService - temas con NuxeoEnlace', () => {
  let service: PlantillaInformeSeguimientoService;
  const nuxeoServiceMock = { obtenerPorUUID: jest.fn() };
  const plantillasMidMock = {
    post: jest.fn(() => Promise.resolve({ Data: 'pdf-base64' })),
  };

  const informe = {
    _id: 'informe-1',
    fecha_emision: '2026-11-04T00:00:00.000Z',
  };
  const auditoria = {
    _id: 'auditoria-1',
    titulo: 'Seguimiento E2E',
    tipo_evaluacion_id: 0,
    dependencia_id: [],
  };
  const temaConImagen = crearTema({
    descripcion_titulo: enlaceNuxeo('uuid-1'),
    subtema: [{ _id: 'sub-1', titulo: 'Subtema', activo: true }],
  });

  const crudMock = {
    traerDataCrud: jest.fn((endpoint: string) => {
      const respuestas: Record<string, any[]> = {
        informe: [informe],
        tema: [temaConImagen],
        'auditoria-estado': [],
        auditor: [],
      };
      return Promise.resolve({ Data: respuestas[endpoint] ?? [] });
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantillaInformeSeguimientoService,
        { provide: PlantillasMidService, useValue: plantillasMidMock },
        { provide: AuditoriaCrudService, useValue: crudMock },
        {
          provide: AuditoriaService,
          useValue: {
            getOne: jest.fn(() => Promise.resolve({ Data: auditoria })),
          },
        },
        {
          provide: TercerosHelperService,
          useValue: { getJefeOCI: jest.fn(), getTerceroVinculado: jest.fn() },
        },
        { provide: OikosService, useValue: { traerData: jest.fn() } },
        { provide: NuxeoService, useValue: nuxeoServiceMock },
      ],
    }).compile();

    service = module.get(PlantillaInformeSeguimientoService);
  });

  afterEach(() => jest.clearAllMocks());

  it('envía a la plantilla el HTML del gestor documental en la descripción del tema', async () => {
    nuxeoServiceMock.obtenerPorUUID.mockReturnValue(
      of(contenidoNuxeoBase64(htmlConImagen)),
    );

    await service.get('auditoria-1');

    expect(nuxeoServiceMock.obtenerPorUUID).toHaveBeenCalledWith('uuid-1');
    const [, cuerpo] = (plantillasMidMock.post as jest.Mock).mock
      .calls[0] as any[];
    const [tema] = cuerpo.data.temas;
    expect(tema.descripcion_titulo).toBe(htmlConImagen);
    expect(tema.descripcion_titulo).not.toContain('NuxeoEnlace');
    expect(tema.subtemas.map((s: any) => s.titulo)).toEqual(['Subtema']);
  });
});
