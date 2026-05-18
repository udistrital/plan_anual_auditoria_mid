import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaPadreService } from './auditoria-padre.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { AuditoriaOrdenadaService } from 'src/shared/services/auditoria-ordenada.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { BadRequestException, NotFoundException, HttpException } from '@nestjs/common';

describe('AuditoriaPadreService', () => {
  let service: AuditoriaPadreService;
  let dominiosService: DominiosService;
  let auditoriaOrdenadaService: AuditoriaOrdenadaService;
  let auditoriaCrudService: AuditoriaCrudService;

  const mockAuditoriaCrudService = {
    traerDataCrud: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
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
          provide: DominiosService,
          useValue: mockDominiosService,
        },
        {
          provide: AuditoriaOrdenadaService,
          useValue: mockAuditoriaOrdenadaService,
        },
        {
          provide: AuditoriaCrudService,
          useValue: mockAuditoriaCrudService,
        },
      ],
    }).compile();

    service = module.get<AuditoriaPadreService>(AuditoriaPadreService);
    dominiosService = module.get<DominiosService>(DominiosService);
    auditoriaOrdenadaService = module.get<AuditoriaOrdenadaService>(
      AuditoriaOrdenadaService,
    );
    auditoriaCrudService = module.get<AuditoriaCrudService>(
      AuditoriaCrudService,
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
      const mockData = { Data: [{ _id: '1' }], Success: true, Status: 200 };
      mockAuditoriaCrudService.traerDataCrud.mockResolvedValue(mockData);

      const result = await service.getAll({});

      expect(result).toEqual(mockData);
      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockAuditoriaCrudService.traerDataCrud.mockRejectedValue(new Error('Error'));

      await expect(service.getAll({})).rejects.toThrow();
    });
  });

  describe('getOne', () => {
    it('should return auditoria padre by id', async () => {
      const mockData = { Data: { _id: '123' }, Success: true, Status: 200 };
      mockAuditoriaCrudService.traerDataCrud.mockResolvedValue(mockData);

      const result = await service.getOne('123');

      expect(result).toEqual(mockData);
      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalled();
    });
  });

  describe('deleteAuditoriaPadre', () => {
    it('should delete auditoria padre successfully', async () => {
      const mockPlan = {
        Data: {
          auditorias: ['123', '456', '789'],
        },
      };
      mockAuditoriaCrudService.traerDataCrud.mockResolvedValue(mockPlan);
      mockAuditoriaCrudService.put.mockResolvedValue({});
      mockAuditoriaCrudService.delete.mockResolvedValue({});

      const result = await service.deleteAuditoriaPadre('123', 'plan-id');

      expect(result.message).toContain('eliminada exitosamente');
      expect(auditoriaCrudService.delete).toHaveBeenCalled();
      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalled();
      expect(auditoriaCrudService.put).toHaveBeenCalledWith(
        'plan-auditoria',
        'plan-id',
        { auditorias: ['456', '789'] },
      );
    });

    it('should throw error if planId is missing', async () => {
      await expect(service.deleteAuditoriaPadre('123', null)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error on delete failure', async () => {
      mockAuditoriaCrudService.traerDataCrud.mockRejectedValue(
        new Error('Delete error'),
      );

      await expect(
        service.deleteAuditoriaPadre('123', 'plan-id'),
      ).rejects.toThrow();
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
