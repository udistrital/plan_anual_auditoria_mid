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

      const res = mockResponse();
      await controller.getAll(res, {});

      expect(service.getAll).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('should handle errors', async () => {
      mockAuditoriaPadreService.getAll.mockRejectedValue(new Error('Test error'));

      const res = mockResponse();
      await controller.getAll(res, {});

      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
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
      const result = { Success: true, Status: 200, Message: 'Eliminada', Data: null };
      mockAuditoriaPadreService.deleteAuditoriaPadre.mockResolvedValue(result);

      const res = mockResponse();
      await controller.delete(res, '123', '456');

      expect(service.deleteAuditoriaPadre).toHaveBeenCalledWith('123', '456');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('should handle delete errors', async () => {
      mockAuditoriaPadreService.deleteAuditoriaPadre.mockRejectedValue(
        new Error('Delete error'),
      );

      const res = mockResponse();
      await controller.delete(res, '123', '456');

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('getAuditoriasOrdenadas', () => {
    it('should return ordered auditorias padre', async () => {
      const result = { Data: [], Success: true, Status: 200 };
      mockAuditoriaPadreService.getAuditoriasOrdenadas.mockResolvedValue(result);

      const res = mockResponse();
      await controller.getAuditoriasOrdenadas(res, { plan_auditoria_id: '1' });

      expect(service.getAuditoriasOrdenadas).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('should handle errors in ordenadas', async () => {
      mockAuditoriaPadreService.getAuditoriasOrdenadas.mockRejectedValue(
        new Error('Ordenadas error'),
      );

      const res = mockResponse();
      await controller.getAuditoriasOrdenadas(res, {});

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
