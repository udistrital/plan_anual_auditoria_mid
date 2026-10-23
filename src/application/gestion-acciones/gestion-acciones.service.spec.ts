import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { GestionAccionesService } from './gestion-acciones.service';

describe('GestionAccionesService (filtro estado_plan_id)', () => {
  let service: GestionAccionesService;
  const traerDataCrud = jest.fn();

  beforeEach(async () => {
    traerDataCrud.mockReset();
    // Sin planes: getAll termina después de consultar plan-mejoramiento
    traerDataCrud.mockResolvedValue({ Data: [] });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestionAccionesService,
        { provide: AuditoriaCrudService, useValue: { traerDataCrud } },
        { provide: TercerosHelperService, useValue: {} },
        { provide: DominiosService, useValue: {} },
      ],
    }).compile();
    service = module.get(GestionAccionesService);
  });

  const queryDePlanes = () => traerDataCrud.mock.calls[0][2].query;

  it('sin estado_plan_id consulta todos los planes de la vigencia', async () => {
    await service.getAll({ vigencia_id: '2026' });
    expect(traerDataCrud).toHaveBeenCalledWith('plan-mejoramiento', null, expect.any(Object));
    expect(queryDePlanes()).toBe('vigencia_id:2026,activo:true');
  });

  it('con estado_plan_id filtra los planes con estado_id__in', async () => {
    await service.getAll({ vigencia_id: '2026', estado_plan_id: '7084|7086' });
    expect(queryDePlanes()).toBe('vigencia_id:2026,activo:true,estado_id__in:7084|7086');
  });

  it('rechaza un estado_plan_id que no sea una lista de números', async () => {
    await expect(
      service.getAll({ vigencia_id: '2026', estado_plan_id: '7084,activo:false' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(traerDataCrud).not.toHaveBeenCalled();
  });
});
