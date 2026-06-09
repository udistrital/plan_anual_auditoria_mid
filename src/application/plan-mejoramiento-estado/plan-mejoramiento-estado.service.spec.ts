import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanMejoramientoEstadoService } from './plan-mejoramiento-estado.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { ParametrosService } from 'src/shared/services/parametros.service';

describe('Servicio PlanMejoramientoEstado', () => {
  let service: PlanMejoramientoEstadoService;
  let auditoriaCrudService: jest.Mocked<AuditoriaCrudService>;
  let tercerosService: jest.Mocked<TercerosHelperService>;
  let parametrosService: jest.Mocked<ParametrosService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanMejoramientoEstadoService,
        {
          provide: AuditoriaCrudService,
          useValue: {
            traerDataCrud: jest.fn(),
          },
        },
        {
          provide: TercerosHelperService,
          useValue: {
            getTerceroById: jest.fn(),
          },
        },
        {
          provide: ParametrosService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlanMejoramientoEstadoService>(PlanMejoramientoEstadoService);
    auditoriaCrudService = module.get(AuditoriaCrudService);
    tercerosService = module.get(TercerosHelperService);
    parametrosService = module.get(ParametrosService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  it('getAll devuelve datos de auditoriaCrudService cuando no existe estado_id', async () => {
    const expected = { Data: [{ id: 1, nombre: 'Prueba' }] };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(expected);

    const result = await service.getAll({ filter: 'test' });

    expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledWith(
      'plan-mejoramiento-estado',
      null,
      { filter: 'test' },
    );
    expect(result).toEqual(expected);
  });

  it('getOne lanza BadRequestException cuando el id está vacío', async () => {
    await expect(service.getOne('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getOne lanza NotFoundException cuando no se encuentra data', async () => {
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce({ Data: null });

    await expect(service.getOne('123')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getOne reemplaza estado y usuario cuando la data contiene estado_id y usuario_id', async () => {
    const rawData = {
      Data: [{ estado_id: 12, usuario_rol: 'ROLE_ADMIN', usuario_id: 99 }],
    };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(rawData);
    parametrosService.get.mockResolvedValueOnce({ Data: [{ Id: 12, Nombre: 'Pendiente' }] });
    tercerosService.getTerceroById.mockResolvedValueOnce({ Id: 99, NombreCompleto: 'juan perez' });

    const result = await service.getOne('123');

    expect(parametrosService.get).toHaveBeenCalled();
    expect(tercerosService.getTerceroById).toHaveBeenCalledWith(99);
    expect(result.Data[0].estado).toEqual({ id: 12, nombre: 'Pendiente' });
    expect(result.Data[0].usuario).toEqual({ id: 99, nombre: 'Juan Perez' });
    expect(result.Data[0].usuario_id).toBeUndefined();
  });
});
