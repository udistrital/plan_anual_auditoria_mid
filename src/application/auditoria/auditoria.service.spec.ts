import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from './auditoria.service';
import { HttpService } from '@nestjs/axios';
import { AuditorService } from '../../auditor/auditor.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: AuditorService, useValue: mockAuditorService },
        { provide: DominiosService, useValue: mockDominiosService },
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

  describe('getAuditoriasOrdenadas', () => {
    it('debe lanzar error si no se proporciona plan_auditoria_id', async () => {
      const queryParams = {};

      await expect(service.getAuditoriasOrdenadas(queryParams)).rejects.toThrow(
        'El parámetro "plan_auditoria_id" es obligatorio.',
      );
    });

    it('debe extraer plan_auditoria_id del parámetro directo', async () => {
      const queryParams = { plan_auditoria_id: '123' };
      const mockAuditorias = {
        Data: [
          { _id: '1', titulo: 'A', activo: true },
          { _id: '2', titulo: 'B', activo: true },
        ],
      };
      const mockPlan = { Data: { auditorias: [] } };
      const mockEstado = { Data: [] };

      mockHttpService.get.mockReturnValueOnce(of({ data: mockAuditorias }));
      mockHttpService.get.mockReturnValueOnce(of({ data: mockEstado }));
      mockHttpService.get.mockReturnValueOnce(of({ data: mockEstado }));
      mockHttpService.get.mockReturnValueOnce(of({ data: mockPlan }));

      const resultado = await service.getAuditoriasOrdenadas(queryParams);

      expect(resultado.Data).toBeDefined();
      expect(resultado.Data.length).toBe(2);
    });

    it('debe filtrar solo auditorías activas', async () => {
      const queryParams = { plan_auditoria_id: '123' };
      const mockAuditorias = {
        Data: [
          { _id: '1', titulo: 'A', activo: true },
          { _id: '2', titulo: 'B', activo: false },
          { _id: '3', titulo: 'C', activo: true },
        ],
      };
      const mockPlan = { Data: { auditorias: [] } };
      const mockEstado = { Data: [] };

      mockHttpService.get.mockReturnValueOnce(of({ data: mockAuditorias }));
      mockHttpService.get.mockReturnValueOnce(of({ data: mockEstado }));
      mockHttpService.get.mockReturnValueOnce(of({ data: mockEstado }));
      mockHttpService.get.mockReturnValueOnce(of({ data: mockPlan }));

      const resultado = await service.getAuditoriasOrdenadas(queryParams);

      expect(resultado.Data.length).toBe(2);
      expect(resultado.Data.every((a: any) => a.activo === true)).toBe(true);
    });
  });
});
