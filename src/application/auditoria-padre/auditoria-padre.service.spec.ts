import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaPadreService } from './auditoria-padre.service';
import { HttpService } from '@nestjs/axios';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { AuditoriaOrdenadaService } from 'src/shared/services/auditoria-ordenada.service';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AuditoriaPadreService', () => {
  let service: AuditoriaPadreService;
  let httpService: HttpService;
  let dominiosService: DominiosService;
  let auditoriaOrdenadaService: AuditoriaOrdenadaService;

  const mockHttpService = {
    get: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
  };

  const mockDominiosService = {
    getParametros: jest.fn(),
    getDependencias: jest.fn(),
  };

  const mockAuditoriaOrdenadaService = {
    getAuditoriasOrdenadas: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaPadreService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: DominiosService,
          useValue: mockDominiosService,
        },
        {
          provide: AuditoriaOrdenadaService,
          useValue: mockAuditoriaOrdenadaService,
        },
      ],
    }).compile();

    service = module.get<AuditoriaPadreService>(AuditoriaPadreService);
    httpService = module.get<HttpService>(HttpService);
    dominiosService = module.get<DominiosService>(DominiosService);
    auditoriaOrdenadaService = module.get<AuditoriaOrdenadaService>(
      AuditoriaOrdenadaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAll', () => {
    it('should return all auditorias padre', async () => {
      const mockData = { Data: [], Success: true, Status: 200 };
      mockHttpService.get.mockReturnValue(of({ data: mockData }));

      const result = await service.getAll({});

      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Error')));

      await expect(service.getAll({})).rejects.toThrow(HttpException);
    });
  });

  describe('getOne', () => {
    it('should return auditoria padre by id', async () => {
      const mockData = { Data: { _id: '123' }, Success: true, Status: 200 };
      mockHttpService.get.mockReturnValue(of({ data: mockData }));

      const result = await service.getOne('123');

      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('deleteAuditoriaPadre', () => {
    it('should delete auditoria padre successfully', async () => {
      const mockPlan = {
        data: {
          Data: {
            auditorias: ['123', '456', '789'],
          },
        },
      };
      mockHttpService.delete.mockReturnValue(of({ data: {} }));
      mockHttpService.get.mockReturnValue(of(mockPlan));
      mockHttpService.put.mockReturnValue(of({ data: {} }));

      const result = await service.deleteAuditoriaPadre('123', 'plan-id');

      expect(result.Success).toBe(true);
      expect(result.Message).toContain('eliminada exitosamente');
      expect(httpService.delete).toHaveBeenCalled();
      expect(httpService.get).toHaveBeenCalled();
      expect(httpService.put).toHaveBeenCalledWith(expect.any(String), {
        auditorias: ['456', '789'],
      });
    });

    it('should throw error if planId is missing', async () => {
      await expect(service.deleteAuditoriaPadre('123', null)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error on delete failure', async () => {
      mockHttpService.delete.mockReturnValue(
        throwError(() => new Error('Delete error')),
      );

      await expect(
        service.deleteAuditoriaPadre('123', 'plan-id'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getAuditoriasOrdenadas', () => {
    it('should return ordered auditorias padre', async () => {
      const mockAuditorias = [{ _id: '1', nombre: 'Test' }];
      mockAuditoriaOrdenadaService.getAuditoriasOrdenadas.mockResolvedValue(
        mockAuditorias,
      );

      const result = await service.getAuditoriasOrdenadas({
        plan_auditoria_id: '1',
      });

      expect(result.Data).toEqual(mockAuditorias);
      expect(result.Success).toBe(true);
      expect(
        auditoriaOrdenadaService.getAuditoriasOrdenadas,
      ).toHaveBeenCalledWith('1', undefined, undefined, {}, 'auditoria-padre');
    });

    it('should throw error if plan_auditoria_id is missing', async () => {
      await expect(service.getAuditoriasOrdenadas({})).rejects.toThrow(
        HttpException,
      );
    });

    it('should apply ordering when orderBy is provided', async () => {
      const mockAuditorias = [
        { _id: '1', nombre: 'B' },
        { _id: '2', nombre: 'A' },
      ];
      mockAuditoriaOrdenadaService.getAuditoriasOrdenadas.mockResolvedValue(
        mockAuditorias,
      );

      const result = await service.getAuditoriasOrdenadas({
        plan_auditoria_id: '1',
        orderBy: 'nombre',
        orderDirection: 'ASC',
      });

      expect(result.Data).toBeDefined();
    });

    it('should extract filters from query params', async () => {
      const mockAuditorias = [{ _id: '1' }];
      mockAuditoriaOrdenadaService.getAuditoriasOrdenadas.mockResolvedValue(
        mockAuditorias,
      );

      await service.getAuditoriasOrdenadas({
        plan_auditoria_id: '1',
        query: 'tipo_evaluacion_id:5',
      });

      expect(
        auditoriaOrdenadaService.getAuditoriasOrdenadas,
      ).toHaveBeenCalledWith(
        '1',
        undefined,
        undefined,
        { tipo_evaluacion_id: '5' },
        'auditoria-padre',
      );
    });
  });
});
