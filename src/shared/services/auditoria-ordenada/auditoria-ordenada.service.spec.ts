import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditoriaOrdenadaService } from './auditoria-ordenada.service';

describe('AuditoriaOrdenadaService', () => {
  let service: AuditoriaOrdenadaService;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaOrdenadaService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<AuditoriaOrdenadaService>(AuditoriaOrdenadaService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getAuditoriasOrdenadas', () => {
    it('debe retornar auditorías ordenadas según el plan', async () => {
      const mockAuditorias = [
        { id: 1, plan_auditoria_id: '123', activo: true, nombre: 'Aud 1' },
        { id: 2, plan_auditoria_id: '123', activo: true, nombre: 'Aud 2' },
        { id: 3, plan_auditoria_id: '123', activo: false, nombre: 'Aud 3' },
      ];

      const mockPlan = {
        id: '123',
        auditorias: [2, 1],
      };

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { Data: mockAuditorias } }))
        .mockReturnValueOnce(of({ data: { Data: mockPlan } }));

      const resultado = await service.getAuditoriasOrdenadas('123');

      expect(resultado).toHaveLength(2);
      expect(resultado.every((a) => a.activo === true)).toBe(true);
    });

    it('debe filtrar auditorías inactivas', async () => {
      const mockAuditorias = [
        { id: 1, activo: true },
        { id: 2, activo: false },
        { id: 3, activo: true },
      ];

      const mockPlan = { auditorias: [] };

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { Data: mockAuditorias } }))
        .mockReturnValueOnce(of({ data: { Data: mockPlan } }));

      const resultado = await service.getAuditoriasOrdenadas('123');

      expect(resultado).toHaveLength(2);
      expect(resultado.every((a) => a.activo === true)).toBe(true);
    });

    it('debe aplicar ordenamiento adicional cuando se especifica', async () => {
      const mockAuditorias = [
        { id: 1, activo: true, nombre: 'B' },
        { id: 2, activo: true, nombre: 'A' },
      ];

      const mockPlan = { auditorias: [] };

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { Data: mockAuditorias } }))
        .mockReturnValueOnce(of({ data: { Data: mockPlan } }));

      const resultado = await service.getAuditoriasOrdenadas(
        '123',
        'nombre',
        'ASC',
      );

      expect(resultado).toHaveLength(2);
      expect(resultado[0].nombre).not.toBe(resultado[1].nombre);
    });

    it('debe lanzar excepción cuando falla obtener auditorías', async () => {
      mockHttpService.get.mockReturnValueOnce(
        throwError(() => new Error('Network error')),
      );

      await expect(service.getAuditoriasOrdenadas('123')).rejects.toThrow(
        HttpException,
      );
      await expect(service.getAuditoriasOrdenadas('123')).rejects.toThrow(
        'Error al obtener auditorías',
      );
    });

    it('debe lanzar excepción cuando falla obtener plan', async () => {
      const mockAuditorias = [{ id: 1, activo: true }];

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { Data: mockAuditorias } }))
        .mockReturnValueOnce(throwError(() => new Error('Network error')));

      await expect(service.getAuditoriasOrdenadas('123')).rejects.toThrow(
        HttpException,
      );
    });

    it('debe manejar respuesta vacía del CRUD', async () => {
      mockHttpService.get
        .mockReturnValueOnce(of({ data: {} }))
        .mockReturnValueOnce(of({ data: { Data: {} } }));

      const resultado = await service.getAuditoriasOrdenadas('123');

      expect(resultado).toEqual([]);
    });

    it('debe manejar plan sin array de auditorías', async () => {
      const mockAuditorias = [{ id: 1, activo: true }];

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { Data: mockAuditorias } }))
        .mockReturnValueOnce(of({ data: { Data: {} } }));

      const resultado = await service.getAuditoriasOrdenadas('123');

      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe(1);
    });
  });
});
