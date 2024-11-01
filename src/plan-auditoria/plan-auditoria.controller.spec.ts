import { Test, TestingModule } from '@nestjs/testing';
import { PlanAuditoriaController } from './plan-auditoria.controller';

describe('PlanAuditoriaController', () => {
  let controller: PlanAuditoriaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanAuditoriaController],
    }).compile();

    controller = module.get<PlanAuditoriaController>(PlanAuditoriaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
