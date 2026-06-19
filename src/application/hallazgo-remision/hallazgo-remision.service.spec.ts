import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { HallazgoRemisionService } from './hallazgo-remision.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';

describe('Servicio HallazgoRemision', () => {
  let service: HallazgoRemisionService;
  let auditoriaCrudService: jest.Mocked<AuditoriaCrudService>;
  let tercerosService: jest.Mocked<TercerosHelperService>;
  let dominiosService: jest.Mocked<DominiosService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallazgoRemisionService,
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
          provide: DominiosService,
          useValue: {
            getDependencias: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HallazgoRemisionService>(HallazgoRemisionService);
    auditoriaCrudService = module.get(AuditoriaCrudService);
    tercerosService = module.get(TercerosHelperService);
    dominiosService = module.get(DominiosService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  it('getAll devuelve datos de auditoriaCrudService cuando no requiere adaptación', async () => {
    const expected = { Data: [{ id: 1, observacion: 'Test' }] };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(expected);

    const result = await service.getAll({ filter: 'test' });

    expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledWith(
      'hallazgo-remision',
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

  it('getOne reemplaza usuario, dependencia_origen y dependencias_destino correctamente', async () => {
    const rawData = {
      Data: [{
        usuario_rol: 'ROLE_ADMIN',
        usuario_id: 99,
        dependencia_origen_id: 123,
        dependencia_destino_id: [456, 789],
      }],
    };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(rawData);
    tercerosService.getTerceroById.mockResolvedValueOnce({
      Id: 99,
      NombreCompleto: 'juan perez',
    });
    dominiosService.getDependencias.mockReturnValueOnce(
      of({ api: 'oikos', nombre: 'dependencias', parametros: [
        { Id: 123, Nombre: 'Dependencia Origen' },
        { Id: 456, Nombre: 'Dependencia Destino 1' },
        { Id: 789, Nombre: 'Dependencia Destino 2' },
      ] }),
    );

    const result = await service.getOne('123');

    expect(tercerosService.getTerceroById).toHaveBeenCalledWith(99);
    expect(dominiosService.getDependencias).toHaveBeenCalledTimes(1);
    expect(result.Data[0].usuario).toEqual({ id: 99, nombre: 'Juan Perez' });
    expect(result.Data[0].dependencia_origen).toEqual({ id: 123, nombre: 'Dependencia Origen' });
    expect(result.Data[0].dependencias_destino).toHaveLength(2);
    expect(result.Data[0].dependencias_destino[0]).toEqual({ id: 456, nombre: 'Dependencia Destino 1' });
    expect(result.Data[0].usuario_id).toBeUndefined();
    expect(result.Data[0].dependencia_origen_id).toBeUndefined();
    expect(result.Data[0].dependencia_destino_id).toBeUndefined();
  });

  it('getAll maneja errores al reemplazar usuario', async () => {
    const rawData = {
      Data: [{ usuario_id: 999 }],
    };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(rawData);
    tercerosService.getTerceroById.mockRejectedValueOnce(new Error('Usuario no encontrado'));

    const result = await service.getAll({});

    expect(result.Data[0].usuario).toEqual({ id: 999, nombre: null });
    expect(result.Data[0].usuario_id).toBeUndefined();
  });

  it('getAll maneja errores al reemplazar dependencia origen', async () => {
    const rawData = {
      Data: [{ dependencia_origen_id: 999 }],
    };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(rawData);
    dominiosService.getDependencias.mockReturnValueOnce(
      of({ api: 'oikos', nombre: 'dependencias', parametros: [] }),
    );

    const result = await service.getAll({});

    expect(result.Data[0].dependencia_origen).toEqual({ id: 999, nombre: null });
    expect(result.Data[0].dependencia_origen_id).toBeUndefined();
  });

  it('getAll maneja array en dependencia_destino_id', async () => {
    const rawData = {
      Data: [{ dependencia_destino_id: [100, 200] }],
    };
    auditoriaCrudService.traerDataCrud.mockResolvedValueOnce(rawData);
    dominiosService.getDependencias.mockReturnValueOnce(
      of({ api: 'oikos', nombre: 'dependencias', parametros: [
        { Id: 100, Nombre: 'Dep 1' },
        { Id: 200, Nombre: 'Dep 2' },
      ] }),
    );

    const result = await service.getAll({});

    expect(result.Data[0].dependencias_destino).toHaveLength(2);
    expect(result.Data[0].dependencias_destino[0]).toEqual({ id: 100, nombre: 'Dep 1' });
    expect(result.Data[0].dependencias_destino[1]).toEqual({ id: 200, nombre: 'Dep 2' });
  });
});
