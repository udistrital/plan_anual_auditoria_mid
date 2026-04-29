import { Test, TestingModule } from '@nestjs/testing';
import { PlanAuditoriaController } from './plan-auditoria.controller';
import { PlanAuditoriaService } from './plan-auditoria.service';

describe('PlanAuditoriaController', () => {
  let controller: PlanAuditoriaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanAuditoriaController],
      providers: [
        {
          provide: PlanAuditoriaService,
          useValue: {
            getAll: jest.fn(),
            getOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PlanAuditoriaController>(PlanAuditoriaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
