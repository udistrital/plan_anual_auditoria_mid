import { Test, TestingModule } from '@nestjs/testing';
import { PlanMejoramientoEstadoController } from './plan-mejoramiento-estado.controller';
import { PlanMejoramientoEstadoService } from './plan-mejoramiento-estado.service';

describe('Controlador PlanMejoramientoEstado', () => {
  let controller: PlanMejoramientoEstadoController;
  let service: PlanMejoramientoEstadoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanMejoramientoEstadoController],
      providers: [
        {
          provide: PlanMejoramientoEstadoService,
          useValue: {
            getAll: jest.fn().mockResolvedValue({ Data: [] }),
            getOne: jest.fn().mockResolvedValue({ Data: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get<PlanMejoramientoEstadoController>(PlanMejoramientoEstadoController);
    service = module.get<PlanMejoramientoEstadoService>(PlanMejoramientoEstadoService);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('getAll debe llamar a service.getAll con los parámetros de consulta', async () => {
    const queryParams = { filter: 'test' };
    await controller.getAll(queryParams);
    expect(service.getAll).toHaveBeenCalledWith(queryParams);
  });

  it('getById debe llamar a service.getOne con el id', async () => {
    const id = '123';
    await controller.getById(id);
    expect(service.getOne).toHaveBeenCalledWith(id);
  });
});
