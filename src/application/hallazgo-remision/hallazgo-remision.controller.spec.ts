import { Test, TestingModule } from '@nestjs/testing';
import { HallazgoRemisionController } from './hallazgo-remision.controller';
import { HallazgoRemisionService } from './hallazgo-remision.service';

describe('Controlador HallazgoRemision', () => {
  let controller: HallazgoRemisionController;
  let service: HallazgoRemisionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HallazgoRemisionController],
      providers: [
        {
          provide: HallazgoRemisionService,
          useValue: {
            getAll: jest.fn().mockResolvedValue({ Data: [] }),
            getOne: jest.fn().mockResolvedValue({ Data: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get<HallazgoRemisionController>(HallazgoRemisionController);
    service = module.get<HallazgoRemisionService>(HallazgoRemisionService);
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
