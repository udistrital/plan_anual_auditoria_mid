import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from './auditoria.service';
import { HttpService } from '@nestjs/axios';
import { AuditorService } from '../../auditor/auditor.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockAuditorService = {
    getAll: jest.fn(),
  };

  const mockDominiosService = {
    getParametros: jest.fn(),
    getDependencias: jest.fn(),
  };

  const mockCrudService = {
    traerDataCrud: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: AuditorService, useValue: mockAuditorService },
        { provide: DominiosService, useValue: mockDominiosService },
        { provide: AuditoriaCrudService, useValue: mockCrudService },
      ],
    }).compile();

    service = module.get<AuditoriaService>(AuditoriaService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('herencia de campos padre', () => {
    it('getByAuditor debe heredar tipo_evaluacion_id y dependencia_id desde padre', async () => {
      // preparar mocks: traerDataCrud llamado para 'auditoria/auditor', 'auditoria-padre', 'auditoria-estado'
      mockCrudService.traerDataCrud.mockImplementation((resource: string, id: any, params: any) => {
        if (resource === 'auditoria-padre') {
          return Promise.resolve({
            Data: [{
              _id: 'p1',
              tipo_evaluacion_id: 7,
              dependencia_id: 42,
              cronograma_nombre: [],
              titulo: 'Padre'
            }],
            MetaData: { Count: 1 },
          });
        }
        if (resource === 'auditoria/auditor') {
          return Promise.resolve({ Data: [{ _id: 'h1', auditoria_padre_id: 'p1', }], });
        }
        // para enriquecerAuditorias -> auditoria-estado
        if (resource === 'auditoria-estado') {
          return Promise.resolve({ Data: [{ actual: true, estado_id: 1 }] });
        }
        return Promise.resolve({ Data: [] });
      });

      mockAuditorService.getAll.mockResolvedValue({ Data: [] });
      mockDominiosService.getParametros.mockReturnValue(of({ parametros: [] }));
      mockDominiosService.getDependencias.mockReturnValue(of({ parametros: [] }));

      const res = await service.getByAuditor('personaX', { query: 'tipo_evaluacion_id:7' });
      expect(res.Data).toBeDefined();
      expect(res.Data.length).toBe(1);
      expect(res.Data[0].tipo_evaluacion_id).toBe(7);
      expect(res.Data[0].dependencia_id).toBe(42);
      expect(res.MetaData.Count).toBe(1);
      // verificar que la consulta a las auditorías del auditor incluyó filtros de hija
      expect(mockCrudService.traerDataCrud).toHaveBeenCalledWith(
        'auditoria/auditor',
        expect.any(String),
        expect.objectContaining({ query: expect.stringContaining('activo:true') }),
      );
      expect(mockCrudService.traerDataCrud).toHaveBeenCalledWith(
        'auditoria/auditor',
        expect.any(String),
        expect.objectContaining({ query: expect.stringContaining('auditoria_padre_id__in:') }),
      );
      expect(mockCrudService.traerDataCrud).toHaveBeenCalledWith(
        'auditoria/auditor',
        'personaX',
        expect.any(Object),
      );
      // verificar que se llamó a traerDataCrud para padres con el query correcto (incluye tipo_evaluacion)
      expect(mockCrudService.traerDataCrud).toHaveBeenCalledWith(
        'auditoria-padre',
        null,
        expect.objectContaining({ query: expect.stringContaining('tipo_evaluacion_id:7') }),
      );
        // verificar que se llamó a traerDataCrud para obtener padres con los fields esperados
        const calls = mockCrudService.traerDataCrud.mock.calls;
        const llamóPadre = calls.some(([resource, id, params]) =>
          resource === 'auditoria-padre' && params && params.fields && params.fields.includes('tipo_evaluacion_id') && params.fields.includes('dependencia_id')
        );
        expect(llamóPadre).toBe(true);
    });

    it('getByDependencia debe heredar tipo_evaluacion_id y dependencia_id desde padre', async () => {
      // mock para getDependenciasByPersona (httpService.get)
      mockHttpService.get.mockReturnValueOnce(of({ data: [{ DependenciaId: 42 }] }));

      // mock traerDataCrud para 'auditoria-padre', 'auditoria' y 'auditoria-estado'
      mockCrudService.traerDataCrud.mockImplementation((resource: string, id: any, params: any) => {
        if (resource === 'auditoria-padre') {
          return Promise.resolve({
            Data: [{
              _id: 'p1',
              tipo_evaluacion_id: 9,
              dependencia_id: 42,
              cronograma_nombre: [],
              titulo: 'PadreD'
            }],
            MetaData: { Count: 1 },
          });
        }
        if (resource === 'auditoria') {
          return Promise.resolve({ Data: [{ _id: 'h2', auditoria_padre_id: 'p1', titulo: 'HijaD' }] });
        }
        if (resource === 'auditoria-estado') {
          return Promise.resolve({ Data: [{ actual: true, estado_id: 2 }] });
        }
        return Promise.resolve({ Data: [] });
      });

      mockAuditorService.getAll.mockResolvedValue({ Data: [] });
      mockDominiosService.getParametros.mockReturnValue(of({ parametros: [] }));
      mockDominiosService.getDependencias.mockReturnValue(of({ parametros: [{ Id: 42, Nombre: 'Dep42' }] }));

      const res = await service.getByDependencia(1, 312, { query: 'tipo_evaluacion_id:9' });
      expect(res.Data).toBeDefined();
      expect(res.Data.length).toBe(1);
      expect(res.Data[0].tipo_evaluacion_id).toBe(9);
      expect(res.Data[0].dependencia_id).toBe(42);
      expect(res.MetaData.Count).toBe(1);
      // verificar que se consultaron las vinculaciones del tercero con los params correctos
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('vinculacion?query=TerceroPrincipalId:1,Activo:true,CargoId:312&fields=DependenciaId'),
      );
      // verificar que se llamó a traerDataCrud para auditoria-padre con filtro por dependencia y tipo_evaluacion
      expect(mockCrudService.traerDataCrud).toHaveBeenCalledWith(
        'auditoria-padre',
        null,
        expect.objectContaining({ query: expect.stringContaining('dependencia_id__in:42') }),
      );
      // y que la consulta de hijas incluyó el filtro activo y auditoria_padre_id__in
      expect(mockCrudService.traerDataCrud).toHaveBeenCalledWith(
        'auditoria',
        null,
        expect.objectContaining({ query: expect.stringContaining('auditoria_padre_id__in:p1') }),
      );
        // verificar query usado para traer padres incluye filtro por dependencia
        const calls = mockCrudService.traerDataCrud.mock.calls;
        const padreCall = calls.find(([resource]) => resource === 'auditoria-padre');
        expect(padreCall).toBeDefined();
        const padreParams = padreCall![2];
        expect(padreParams.query).toContain('dependencia_id__in:');
        expect(padreParams.query).toContain('tipo_evaluacion_id:9');

        // verificar que las hijas se solicitaron con filtro activo y auditoria_padre_id__in
        const hijaCall = calls.find(([resource]) => resource === 'auditoria');
        expect(hijaCall).toBeDefined();
        const hijaParams = hijaCall![2];
        expect(hijaParams.query).toContain('activo:true');
        expect(hijaParams.query).toContain('auditoria_padre_id__in:');
        expect(hijaParams.query).toContain('tipo_evaluacion_id:9');
    });
  });
});
