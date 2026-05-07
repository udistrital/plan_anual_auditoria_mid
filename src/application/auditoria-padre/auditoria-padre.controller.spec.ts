import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaPadreController } from './auditoria-padre.controller';
import { AuditoriaPadreService } from './auditoria-padre.service';
import { HttpStatus } from '@nestjs/common';

describe('AuditoriaPadreController', () => {
  let controller: AuditoriaPadreController;
  let service: AuditoriaPadreService;

  const mockAuditoriaPadreService = {
    getAll: jest.fn(),
    getOne: jest.fn(),
    getAuditoriasOrdenadas: jest.fn(),
    deleteAuditoriaPadre: jest.fn(),
  };

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaPadreController],
      providers: [
        {
          provide: AuditoriaPadreService,
          useValue: mockAuditoriaPadreService,
        },
      ],
    }).compile();

    controller = module.get<AuditoriaPadreController>(AuditoriaPadreController);
    service = module.get<AuditoriaPadreService>(AuditoriaPadreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('should return all auditorias padre', async () => {
      const result = { Data: [], Success: true, Status: 200 };
      mockAuditoriaPadreService.getAll.mockResolvedValue(result);

      const response = await controller.getAll({});

      expect(service.getAll).toHaveBeenCalled();
      expect(response).toEqual(result);
    });
  });

  describe('getById', () => {
    it('should return auditoria padre by id', async () => {
      const result = { Data: { _id: '123' }, Success: true, Status: 200 };
      mockAuditoriaPadreService.getOne.mockResolvedValue(result);

      const response = await controller.getById('123');

      expect(service.getOne).toHaveBeenCalledWith('123');
      expect(response).toEqual(result);
    });
  });

  describe('delete', () => {
    it('should delete auditoria padre', async () => {
      const result = {
        message: 'Eliminada',
      };
      mockAuditoriaPadreService.deleteAuditoriaPadre.mockResolvedValue(result);

      const response = await controller.delete('123', '456');

      expect(service.deleteAuditoriaPadre).toHaveBeenCalledWith('123', '456');
      expect(response).toEqual(result);
    });
  });

  describe('getAuditoriasOrdenadas', () => {
    it('should return ordered auditorias padre', async () => {
      const result = { Data: [], Success: true, Status: 200 };
      mockAuditoriaPadreService.getAuditoriasOrdenadas.mockResolvedValue(
        result,
      );

      const response = await controller.getAuditoriasOrdenadas({ plan_auditoria_id: '1' });

      expect(service.getAuditoriasOrdenadas).toHaveBeenCalled();
      expect(response).toEqual(result);
    });
  });
});
